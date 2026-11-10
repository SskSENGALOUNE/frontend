# ขึ้น server: Money Manager

สำหรับ: server Ubuntu/Debian ที่มี Docker แล้ว ยังไม่มี domain (เข้าผ่าน `http://IP`)
วิธีนี้ **build บน Mac แล้วส่งเฉพาะ image ขึ้น server** server ไม่ต้อง build อะไร และไม่มีซอร์สโค้ดอยู่บนนั้น

## ภาพรวม

```
Mac:     deploy/release.sh
           ├─ docker build (linux/amd64) → image backend + frontend
           ├─ docker save | gzip         → ไฟล์ ~70 MB
           └─ rsync ขึ้น server ──────────────────────────────┐
                                                             ▼
Server:  /opt/money-manager    docker load → backup DB → docker compose up -d

อินเทอร์เน็ต ──:80──▶ caddy ──/api/*──▶ backend (Go) ──▶ db (Postgres)
                         └──อื่นๆ────▶ frontend (Next.js)
```

- เปิดออกอินเทอร์เน็ตแค่ **caddy port 80** ส่วน database กับ backend คนนอกเข้าไม่ได้
- ข้อมูล database อยู่ใน Docker volume `db-data` ไม่หายตอนอัปเดตหรือ restart
- ตอน start backend สร้างและอัปเดตตารางเอง (migration)
- server เก็บ 3 เวอร์ชันล่าสุดไว้ ถ้าเวอร์ชันใหม่มีปัญหา ย้อนกลับได้ด้วยคำสั่งเดียว

**ไฟล์บน server** (`/opt/money-manager`):

| ไฟล์ | คืออะไร |
|---|---|
| `docker-compose.yml`, `Caddyfile` | ส่งขึ้นไปจาก `deploy/` ทุกครั้งที่ release |
| `.env` | ค่าลับของ server สร้างเองครั้งเดียว ไม่ถูกเขียนทับ |
| `backup.sh`, `rollback.sh` | สำหรับใช้บน server |
| `releases/*.tar.gz` | ไฟล์ image 3 เวอร์ชันล่าสุด |
| `backups/*.sql.gz` | backup database |

---

## Step 1: เช็ค server (ครั้งแรกครั้งเดียว)

```bash
ssh user@SERVER_IP

docker version          # ต้องมีทั้ง Client และ Server
docker compose version  # v2 ขึ้นไป
uname -m                # x86_64 = ใช้ค่า default ได้เลย | aarch64 = ดูหมายเหตุ Step 4
```

**ถ้ารัน `docker` โดยไม่มี `sudo` ไม่ได้** ให้รันคำสั่งนี้ แล้ว logout แล้ว login ใหม่ (`release.sh` ต้องเรียก docker ได้โดยไม่ใช้ sudo):

```bash
sudo usermod -aG docker $USER
```

**เปิด firewall** ต้องเปิด port 22 ก่อน ไม่งั้นจะ SSH เข้าไม่ได้:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
```

ถ้าใช้ cloud (AWS, GCP ฯลฯ) ต้องเปิด port 80 ใน Security Group หรือ firewall ของ cloud ด้วย

**เช็คว่า port 80 ว่าง:** `sudo ss -ltnp | grep ':80 '` ถ้าไม่มีผลลัพธ์แปลว่าว่าง ถ้าไม่ว่าง ดู [แก้ปัญหา](#แก้ปัญหา)

---

## Step 2: ตั้ง SSH key (บน Mac, ครั้งแรกครั้งเดียว)

`release.sh` เรียก ssh และ rsync หลายครั้ง ถ้าตั้ง key ไว้จะไม่ต้องพิมพ์รหัสผ่านซ้ำทุกครั้ง:

```bash
ls ~/.ssh/id_ed25519.pub || ssh-keygen -t ed25519      # สร้าง key ถ้ายังไม่มี (กด Enter ได้หมด)
ssh-copy-id user@SERVER_IP                             # ใส่รหัสผ่าน server ครั้งสุดท้าย
ssh user@SERVER_IP 'echo ok'                           # ต้องขึ้น ok โดยไม่ถามรหัส
```

---

## Step 3: สร้างโฟลเดอร์และ `.env` บน server (ครั้งแรกครั้งเดียว)

บน **Mac**:

```bash
cd ~/Documents/Iquery_work/Money_Manager
ssh user@SERVER_IP 'sudo mkdir -p /opt/money-manager && sudo chown $USER /opt/money-manager'
scp deploy/.env.example user@SERVER_IP:/opt/money-manager/.env
```

บน **server**:

```bash
cd /opt/money-manager
echo "DB_PASSWORD=$(openssl rand -hex 32)"     # คัดลอกค่าที่ได้
echo "JWT_SECRET=$(openssl rand -hex 32)"      # คัดลอกค่าที่ได้
nano .env                                      # วาง 2 ค่าข้างบน แล้วกด Ctrl+O, Enter, Ctrl+X
chmod 600 .env
```

| ตัวแปร | ใส่อะไร |
|---|---|
| `DB_PASSWORD` | รหัส database **ตั้งครั้งแรกแล้วห้ามเปลี่ยน** เพราะ Postgres จำรหัสไว้ใน volume |
| `JWT_SECRET` | key สำหรับ login ถ้าเปลี่ยน ทุกคนจะถูก logout |
| `SITE_ADDRESS` | `:80` ไปก่อน พอมี domain ค่อยเปลี่ยน (Step 8) |
| `HTTP_PORT` | `80` เปลี่ยนเฉพาะตอนที่ port 80 มีโปรแกรมอื่นใช้ |
| `APP_TAG` | ปล่อยว่างไว้ `release.sh` จะใส่ให้เอง |

**เก็บสำรอง `DB_PASSWORD` และ `JWT_SECRET` ไว้ที่อื่นด้วย** เช่นในโปรแกรมจัดการรหัสผ่าน

---

## Step 4: Build และ deploy (บน Mac)

ต้องเปิด Docker Desktop บน Mac ไว้ แล้วรัน:

```bash
cd ~/Documents/Iquery_work/Money_Manager
SERVER=user@SERVER_IP ./deploy/release.sh
```

script ทำ 4 ขั้นและพิมพ์บอกทีละขั้น:

| ขั้น | ทำอะไร | ใช้เวลาประมาณ |
|---|---|---|
| 1/4 build | build image backend + frontend สำหรับ `linux/amd64` | ครั้งแรก 5–30 นาที ครั้งต่อไปราว 1 นาที |
| 2/4 export | `docker save` รวม 2 image เป็นไฟล์ `.tar.gz` | ไม่กี่วินาที (ไฟล์ ~70 MB) |
| 3/4 upload | rsync ไฟล์ image และ `docker-compose.yml`, `Caddyfile`, script ขึ้น server | แล้วแต่เน็ต |
| 4/4 start | บน server: `docker load` → backup DB (ถ้ามีอยู่แล้ว) → ใส่ `APP_TAG` ใน `.env` → `docker compose up -d` → รอจน API ผ่าน health check → ลบเวอร์ชันเก่าเกิน 3 | ราว 30 วินาที |

ถ้าสำเร็จ บรรทัดสุดท้ายจะขึ้นว่า `deployed version 20261006-164543`

ถ้า server เป็น ARM (`uname -m` ได้ `aarch64`) ให้รันแบบนี้แทน:

```bash
SERVER=user@SERVER_IP PLATFORM=linux/arm64 ./deploy/release.sh
```

---

## Step 5: เช็คและเปิดใช้งาน

บน server:

```bash
cd /opt/money-manager
docker compose ps                   # 4 service ต้อง Up, db กับ backend เป็น (healthy)
curl http://localhost/health        # {"success":true,"message":"ok"}
```

เปิดเบราว์เซอร์ที่ **`http://SERVER_IP`** → กด "ສະໝັກນຳໃຊ້" → สร้างบัญชี

ข้อมูลในเครื่อง dev **ไม่ได้ย้ายขึ้นไปด้วย** server เริ่มจาก database ว่าง (ถ้าจะย้ายข้อมูล ดู [ย้ายข้อมูลจากเครื่อง dev](#ย้ายข้อมูลจากเครื่อง-dev))

> ⚠️ **ตอนยังไม่มี domain ระบบเป็น HTTP** รหัสผ่านถูกส่งแบบไม่เข้ารหัส ใช้ทดสอบได้ แต่ก่อนให้คนอื่นใช้จริงควรทำ Step 8 (HTTPS)

---

## Step 6: ตั้ง backup อัตโนมัติ (บน server, ครั้งแรกครั้งเดียว)

```bash
cd /opt/money-manager
./backup.sh                 # ทดสอบ: saved backups/money_manager-….sql.gz
crontab -e
# เพิ่มบรรทัดนี้ (backup ทุกวันตอน 02:30 และเก็บ 14 ไฟล์ล่าสุด):
30 2 * * * /opt/money-manager/backup.sh >> /opt/money-manager/backups/backup.log 2>&1
```

นอกจากนี้ `release.sh` จะ backup ให้อัตโนมัติก่อนอัปเดตทุกครั้ง

ไฟล์ backup อยู่บนเครื่องเดียวกับ server ถ้า server พังจะหายไปด้วย ควรดึงมาเก็บที่ Mac เป็นระยะ:

```bash
rsync -av user@SERVER_IP:/opt/money-manager/backups/ ~/money-manager-backups/
```

**กู้คืนจาก backup** (เขียนทับข้อมูลปัจจุบันทั้งหมด):

```bash
cd /opt/money-manager
gunzip -c backups/money_manager-YYYYmmdd-HHMM.sql.gz | docker compose exec -T db psql -U money -d money_manager
```

---

## Step 7: อัปเดตเวอร์ชันใหม่ และย้อนกลับ

**อัปเดต:** แก้โค้ดบน Mac แล้วรันคำสั่งเดิม

```bash
SERVER=user@SERVER_IP ./deploy/release.sh
```

ระหว่าง build และ upload ระบบเดิมยังใช้งานได้ปกติ จะสะดุดเฉพาะไม่กี่วินาทีตอนสลับ container ส่วน migration ใหม่ backend จะรันเองตอน start

**ย้อนกลับ:** ถ้าเวอร์ชันใหม่มีปัญหา รันบน server

```bash
cd /opt/money-manager
./rollback.sh                    # กลับไปเวอร์ชันก่อนหน้า
./rollback.sh 20261006-164543    # หรือระบุเวอร์ชัน (ดูรายการได้จากบรรทัด "available:")
```

`rollback.sh` สลับเฉพาะโค้ด **ไม่ได้ย้อน database** ถ้าเวอร์ชันที่มีปัญหาทำข้อมูลเสียไปด้วย ให้กู้จาก backup ที่ `release.sh` ทำไว้ก่อนอัปเดต (ดู Step 6)

---

## Step 8: เมื่อมี domain → เปิด HTTPS

1. ที่ผู้ให้บริการ domain สร้าง **A record** เช่น `money.example.com` → `SERVER_IP` แล้วรอให้มีผล (`ping money.example.com` ต้องได้ IP ของ server)
2. บน server:
   ```bash
   sudo ufw allow 443/tcp
   cd /opt/money-manager
   nano .env                         # แก้เป็น SITE_ADDRESS=money.example.com
   docker compose up -d caddy
   docker compose logs -f caddy      # รอจนเห็น "certificate obtained successfully" แล้วกด Ctrl+C
   ```
3. เปิด **`https://money.example.com`** Caddy ขอ certificate จาก Let's Encrypt และต่ออายุให้เอง ส่วน `http://` จะถูก redirect ไป `https://` อัตโนมัติ

---

## คำสั่งที่ใช้บ่อย (บน server ในโฟลเดอร์ `/opt/money-manager`)

| ทำอะไร | คำสั่ง |
|---|---|
| ดูสถานะ | `docker compose ps` |
| ดูเวอร์ชันที่รันอยู่ | `grep APP_TAG .env` |
| ดู log สด | `docker compose logs -f backend` (หรือ `frontend`, `caddy`, `db`) |
| restart ตัวเดียว | `docker compose restart backend` |
| หยุดทั้งหมด (ข้อมูลไม่หาย) | `docker compose down` |
| เปิดกลับ | `docker compose up -d` |
| เข้า database | `docker compose exec db psql -U money -d money_manager` |
| ดูการใช้ CPU/RAM | `docker stats` |

> ⛔ **ห้ามใช้ `docker compose down -v`** เพราะ `-v` จะลบ volume ซึ่งก็คือ **ข้อมูลทั้งหมดใน database**

---

## ย้ายข้อมูลจากเครื่อง dev

ทำหลัง Step 5 และ **ก่อนสมัครบัญชีบน server**:

```bash
# บน Mac
cd ~/Documents/Iquery_work/Money_Manager/backend && set -a && . ./.env && set +a
PGPASSWORD=$DB_PASSWORD /Library/PostgreSQL/17/bin/pg_dump -h localhost -U postgres \
  --data-only --exclude-table=schema_migrations money_manager | gzip > ~/mm-data.sql.gz
scp ~/mm-data.sql.gz user@SERVER_IP:/tmp/

# บน server
cd /opt/money-manager
gunzip -c /tmp/mm-data.sql.gz | docker compose exec -T db psql -U money -d money_manager
```

DB บน Mac ตอนนี้มี user ทดสอบ 27 คน (`e2e-…@test.la`) ค้างอยู่ ควรลบออกก่อน dump

---

## แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `release.sh` ค้างที่ 1/4 หรือขึ้น `Cannot connect to the Docker daemon` | ยังไม่ได้เปิด Docker Desktop บน Mac |
| `release.sh` ถามรหัสผ่านหลายรอบ | ยังไม่ได้ทำ Step 2 (SSH key) |
| `!! /opt/money-manager/.env is missing` | ยังไม่ได้ทำ Step 3 |
| `permission denied ... docker.sock` ตอนขั้น 4/4 | user บน server ยังไม่อยู่ในกลุ่ม docker (ดู Step 1) แล้ว login ใหม่ |
| `exec format error` ใน log | สถาปัตยกรรม CPU ไม่ตรง ถ้า server เป็น ARM ให้ใช้ `PLATFORM=linux/arm64` |
| `Bind for 0.0.0.0:80 failed: port is already allocated` | มีโปรแกรมอื่นใช้ port 80 ดูด้วย `sudo ss -ltnp \| grep ':80 '` ถ้าไม่ได้ใช้ให้หยุด (`sudo systemctl disable --now nginx`) ถ้ายังใช้อยู่ให้ตั้ง `HTTP_PORT=8080` ใน `.env` แล้วเข้า `http://IP:8080` |
| `!! API did not become healthy` | ดู `docker compose logs backend` ถ้าแก้ไม่ได้ทันที ใช้ `./rollback.sh` กลับไปก่อน |
| backend log: `password authentication failed` | แก้ `DB_PASSWORD` หลังสร้าง database ไปแล้ว ให้ใส่รหัสเดิมกลับไป |
| เปิดเว็บแล้วขึ้น `502 Bad Gateway` | backend หรือ frontend ยังไม่ขึ้น หรือล้ม ดูด้วย `docker compose ps` และ `docker compose logs` |
| เปิดจากข้างนอกไม่ได้ แต่ `curl localhost/health` บน server ได้ | firewall ยังไม่เปิด port 80 ทั้ง ufw และของ cloud provider |

## ความปลอดภัย

- database กับ backend ไม่เปิดออกนอกเครื่อง ถ้าจะเข้า database ให้ใช้ `docker compose exec db psql`
- `.env` อยู่บน server เท่านั้น `release.sh` ไม่ส่งไฟล์นี้และไม่เขียนทับ อย่าส่งขึ้น git
- ยังไม่มี rate limit ที่หน้า login (ดู `docs/qa-report.md`) ควรทำ HTTPS (Step 8) ก่อนให้คนอื่นใช้จริง
