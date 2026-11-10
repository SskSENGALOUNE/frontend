# Prompt: ปรับ UX/UI frontend ของ Money Manager (mobile-first) + ทดสอบ + หาบั๊ก

> คัดลอกทั้งไฟล์นี้ไปใช้เป็น prompt ให้ AI coding agent (เช่น Claude Code) ที่เปิดอยู่ในโฟลเดอร์ `Money_Manager/`

---

## บทบาทและเป้าหมาย

คุณเป็น frontend engineer + UX designer ที่ทำงานในโปรเจกต์ `Money_Manager/` ซึ่งเป็นแอปบันทึกรายรับรายจ่ายส่วนตัวสำหรับผู้ใช้ในลาว

งานมี 3 ส่วน ทำตามลำดับ:

1. **ปรับ UX/UI ของ `frontend/` ใหม่ทั้งหมดแบบ mobile-first** ใส่ไอคอนให้ดูสวยและเข้าใจง่ายขึ้น
2. **เขียนชุดทดสอบ** ทดสอบความถูกต้องและความง่ายในการใช้งาน
3. **หาบั๊กและรายงาน** แก้บั๊กที่อยู่ในขอบเขต และรายงานส่วนที่เหลือ

ผู้ใช้หลักใช้ **มือถือ** บันทึกรายจ่ายระหว่างวัน มักบันทึกหลายรายการรวดเดียว (เช่น ตอนเย็นกรอกค่าข้าว ค่าน้ำมัน ค่ากาแฟ) และเปิดดูภาพรวมสิ้นเดือน เป้าหมายสำคัญที่สุด: **บันทึกรายจ่าย 1 รายการได้ภายใน 3 แตะ + พิมพ์ตัวเลข**

---

## บริบทของระบบ (อ่านก่อนเริ่ม)

### โครงสร้าง
```
Money_Manager/
├── backend/    Go Fiber v2 + PostgreSQL (pgx v5)   README.md มี endpoint ทั้งหมด
├── frontend/   Next.js 16 (App Router) + Tailwind v4 + TypeScript
└── web/        หน้า HTML ทดสอบ API แบบเก่า (ไม่ต้องแก้)
```

### Frontend ปัจจุบัน
- ทุกหน้าเป็น client component (`"use client"`) เรียก API ผ่าน `/api/v1/*` ซึ่ง `next.config.ts` rewrite ไปที่ Go backend (`BACKEND_URL`)
- `src/lib/api.ts`: types ทั้งหมด + `get/post/put/del` + `errorText()`
- `src/lib/auth.tsx`: `AuthProvider` เก็บ JWT ใน localStorage ถ้าได้ 401 จะ logout
- `src/lib/use-data.ts`: hook ดึงข้อมูล (`data, error, loading, reload`)
- `src/lib/format.ts`: `money()`, `today()`, `monthRange()`, ชื่อเดือนภาษาลาว
- `src/components/`: `ui.tsx` (Money, Alert, Bar, MonthPicker, TypeToggle), `nav.tsx`, `trend-chart.tsx` (SVG เขียนเอง), `transaction-dialog.tsx`
- หน้า: `/login`, `/` ภาพรวม, `/entry` บันทึก, `/transactions`, `/budgets`, `/recurring`, `/categories` (ทุกหน้ายกเว้น login อยู่ใน `src/app/(app)/` ซึ่งบังคับ login)
- ฟอนต์ Noto Sans Lao (`next/font`) ตัวเลขใช้ IBM Plex Mono สีเป็น token ใน `globals.css` (`--income` เขียว, `--expense` แดงอิฐ, `--accent` น้ำเงิน) รองรับ dark mode

### Backend API ที่ใช้ (ห้ามเปลี่ยน contract)
ทุก response มีรูปแบบ `{ success, message?, data?, errors? }` วันที่เป็น `YYYY-MM-DD` เงินเป็น number (NUMERIC 18,2)

| ใช้ทำ | Endpoint |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` → `{token, user}`; `GET/PUT /me`, `PUT /me/password` |
| หมวด | `GET /categories?type=`, `POST`, `PUT /:id` (`name, color, icon`), `DELETE /:id` (409 ถ้ายังมีรายการใช้) |
| รายการ | `GET /transactions?type&category_id&from&to&q&page&limit` (มี `totals`), `POST`, `PUT /:id`, `DELETE /:id` |
| รายจ่ายหลายรายการ | `POST /expenses` body = `[{category_id, amount, note?, txn_date?}]` สูงสุด 100 รายการ ถ้ามีรายการไหนผิดจะไม่บันทึกเลยสักรายการ, error `invalid_items: [index]` หรือ `"[i].field"` |
| รายงาน | `GET /reports/summary`, `/reports/by-category?type=`, `/reports/trend?period=day\|month`, `/reports/budget?month=YYYY-MM` |
| งบ | `GET /budgets?month=`, `PUT /budgets` (upsert), `POST /budgets/copy`, `DELETE /budgets/:id` |
| รายการประจำ | `GET/POST /recurring`, `PUT /recurring/:id` (`type, category_id, amount, note, end_date, active`), `DELETE` |

หมวดเริ่มต้นมี field `icon` เป็นคำภาษาอังกฤษ: `briefcase, gift, plus, utensils, car, bag, receipt, heart, film, book, dots`

---

## ข้อกำหนดที่ต้องทำตาม

1. **Next.js 16 ต่างจากเวอร์ชันที่คุณคุ้น** อ่าน `frontend/AGENTS.md` และ docs ใน `frontend/node_modules/next/dist/docs/` ก่อนเขียนโค้ด (เช่น `params` เป็น async, `middleware` เปลี่ยนชื่อเป็น `proxy`)
2. **ข้อความใน UI ทั้งหมดเป็นภาษาลาว** ใช้คำที่คนลาวใช้จริง ใช้ฟอนต์ Noto Sans Lao ต่อ ห้ามมีภาษาไทยหลุดใน UI (ตรวจด้วย regex `[฀-๿]` ใน `src/`)
3. **ไม่เปลี่ยน API contract ของ backend** ถ้าบั๊กต้องแก้ที่ backend ให้แก้เฉพาะรายการที่ระบุไว้ในหัวข้อ "บั๊กที่รู้แล้ว" พร้อมเขียน test ส่วนบั๊ก backend อื่นที่เจอให้รายงานอย่างเดียว ไม่ต้องแก้
4. **ห้ามแตะ database จริง** (`money_manager` ที่ localhost:5432) ทดสอบกับ Postgres ชั่วคราวใน Docker เท่านั้น:
   ```bash
   docker run -d --rm --name mm-test-pg -e POSTGRES_PASSWORD=test -p 55999:5432 postgres:16-alpine
   cd backend && DB_PORT=55999 DB_PASSWORD=test APP_PORT=18080 go run ./cmd/server
   cd frontend && BACKEND_URL=http://localhost:18080 npm run dev
   ```
   ปิดและลบ container เมื่อเสร็จ
5. **dependency ให้น้อยที่สุด** ที่อนุญาต:
   - ไอคอน: `lucide-react` (tree-shakable)
   - ทดสอบ: `@playwright/test`, `vitest` (+ `@testing-library/react` ถ้าจำเป็น)
   - ห้ามเพิ่ม UI kit ใหญ่ (MUI, Ant Design ฯลฯ) และ chart library (ใช้ SVG เดิมแล้วปรับ)
6. `npm run lint` และ `npm run build` ต้องผ่าน ไม่มี error และไม่มี warning ใหม่

---

## ส่วนที่ 1: ปรับ UX/UI แบบ mobile-first

ออกแบบที่ความกว้าง **375px ก่อน** แล้วค่อยขยายไป tablet/desktop

### โครงหลัก
- **Bottom tab bar** บนมือถือ (fixed ล่างจอ, เผื่อ `env(safe-area-inset-bottom)`) มี 4 แท็บพร้อมไอคอนและชื่อ: ພາບລວມ, ລາຍການ, ງົບປະມານ, ເພີ່ມເຕີມ (เมนูรวม รายการประจำ, หมวด, โปรไฟล์, ออกจากระบบ)
- **ปุ่ม + ลอยตรงกลางหรือมุมขวาล่าง (FAB)** เปิดหน้าบันทึกได้จากทุกหน้า
- จอ ≥ 1024px เปลี่ยนเป็น sidebar ทางซ้าย
- จุดที่แตะได้ทุกจุดต้องใหญ่อย่างน้อย **44×44px** ส่วน input ใช้ `font-size ≥ 16px` เพื่อกัน iOS ซูมเอง

### ไอคอน
- ใช้ `lucide-react` ทำ mapping จาก `category.icon` ไปเป็นไอคอน ไว้ที่ `src/lib/category-icons.ts`: briefcase→Briefcase, gift→Gift, plus→CirclePlus, utensils→Utensils, car→Car, bag→ShoppingBag, receipt→Receipt, heart→HeartPulse, film→Clapperboard, book→BookOpen, dots→Ellipsis ถ้าไม่มีใน map ให้ใช้ไอคอน default
- ทุกหมวดแสดงเป็น **วงกลมสีอ่อน + ไอคอน** ถ้า `color` เป็น null ให้ derive สีจากชื่อหมวดแบบ deterministic ใช้ palette 8 สีที่อ่านได้ทั้ง light และ dark
- หน้าหมวดต้อง **เลือกไอคอนและสีได้** (backend รองรับ `PUT /categories/:id` ที่มี `icon, color` อยู่แล้ว) ใช้รายการไอคอนจำกัดราว 24 ตัวที่เกี่ยวกับการเงินหรือชีวิตประจำวัน
- ใช้ไอคอนประกอบ ไม่ใช่แทนข้อความ: ปุ่มสำคัญต้องมีข้อความกำกับ ส่วนปุ่มที่มีแต่ไอคอนต้องมี `aria-label` ภาษาลาว

### หน้าบันทึก (สำคัญที่สุด)
ออกแบบใหม่ให้เร็วบนมือถือ:
1. เลือกประเภท รายจ่าย/รายรับ (ค่าเริ่มต้นคือรายจ่าย)
2. **ตารางไอคอนหมวด** (grid 4 คอลัมน์) แตะเพื่อเลือก แทน dropdown
3. ช่องจำนวนเงินตัวใหญ่ `inputMode="decimal"` แสดงตัวคั่นหลักพันระหว่างพิมพ์ มีปุ่มจำนวนลัด (เช่น 5,000 / 10,000 / 20,000 / 50,000 กีบ)
4. วันที่ (ค่าเริ่มต้นวันนี้ มีชิป ມື້ນີ້ / ມື້ວານ) และหมายเหตุ (พับเก็บไว้)
5. **โหมดหลายรายการ:** กด "ເພີ່ມໃສ່ລາຍການ" แล้วรายการไปอยู่ในตะกร้าด้านล่าง แก้หรือลบได้ เห็นยอดรวม แล้วกด "ບັນທຶກທັງໝົດ" ทีเดียว ส่งเป็น `POST /expenses` (จำกัด 100 รายการใน UI) ถ้า API ตอบ `invalid_items` ให้ไฮไลต์รายการที่ผิดในตะกร้า
6. หลังบันทึก: แสดง toast สำเร็จพร้อมยอดรวม ล้างฟอร์ม คงหมวดล่าสุดไว้ และสั่น haptic เบาๆ ถ้ามี `navigator.vibrate`
7. จำหมวดที่ใช้บ่อย 4 อันดับแรกไว้ใน localStorage แล้วแสดงไว้แถวบนสุด

### หน้าอื่น
- **ภาพรวม:**
  - การ์ดยอดคงเหลือใหญ่ด้านบน และรายรับ/รายจ่ายพร้อมลูกศรเทียบเดือนก่อน
  - กราฟต้องพอดีจอ 375px โดยไม่ต้องเลื่อนแนวนอน ใช้รายสัปดาห์หรือแท่งบางลง และแตะแท่งเพื่อดูยอดได้
  - top 5 หมวดรายจ่ายพร้อมไอคอน, งบที่ใกล้หมดหรือเกิน, รายการล่าสุด
  - empty state ที่ชวนให้ "ບັນທຶກລາຍການທຳອິດ"
- **ລາຍການ:**
  - จัดกลุ่มตามวัน (หัวกลุ่มแสดงวันที่และยอดสุทธิของวันนั้น)
  - ช่องค้นหาแบบ debounce 300ms, filter เป็น bottom sheet
  - แตะรายการเพื่อแก้ไขใน bottom sheet, ลบได้พร้อมยืนยัน
  - โหลดต่อด้วย "ໂຫຼດເພີ່ມ" หรือ infinite scroll
- **ງົບປະມານ:** การ์ดต่อหมวด มีไอคอน, progress bar 3 สี (ปกติ / ≥80% / เกิน), แตะเพื่อแก้งบใน bottom sheet
- **ລາຍການປະຈຳ:** เพิ่ม **แก้ไข** (ตอนนี้ทำได้แค่หยุด/ลบ), ระบุ "ຄັ້ງຕໍ່ໄປ" ชัดเจน
- **โปรไฟล์ (ใหม่):** แก้ชื่อ, สกุลเงิน, เปลี่ยนรหัสผ่าน (`PUT /me`, `PUT /me/password`)
- **Login:** ปุ่มแสดง/ซ่อนรหัสผ่าน, ข้อความ error ภาษาลาวที่บอกวิธีแก้

### มาตรฐานร่วม
- ทุกหน้าที่โหลดข้อมูลต้องมี **skeleton** ระหว่างโหลด, **empty state**, **error state ที่มีปุ่มลองใหม่**
- เปลี่ยนเดือนหรือ filter แล้วต้องไม่โชว์ข้อมูลเก่าค้างไว้แบบดูเหมือนข้อมูลใหม่ (ดูบั๊ก #3)
- ปุ่มทุกปุ่มต้องมีสถานะ disabled หรือ loading ระหว่างส่ง เพื่อกันกดซ้ำ
- toast แจ้งผลสำเร็จหรือผิดพลาด (เขียนเอง ไม่ต้องลง library)
- ตัวเลขเงินใช้ `tabular-nums` คั่นหลักพัน รายรับสีเขียวมี "+" รายจ่ายสีแดงมี "−"
- รองรับ dark mode ทุก component และ contrast ผ่าน WCAG AA
- เคารพ `prefers-reduced-motion`

---

## ส่วนที่ 2: ทดสอบ

### Unit (vitest)
- `format.ts`: `money`, `monthRange` (ก.พ. ปีอธิกสุรทิน, ธ.ค. → ม.ค.), `shiftMonth`, `dateLabel`
- category icon mapping และ fallback, การ derive สีจากชื่อ
- logic ตะกร้าบันทึกหลายรายการ (เพิ่ม/ลบ/รวมยอด/จำกัด 100/แปลง index ของ error กลับเป็นรายการ)

### E2E (Playwright) ใช้ viewport iPhone 13 เป็นหลัก + desktop 1280px
ทุก test สมัคร user ใหม่ด้วยอีเมลสุ่ม รันกับ backend + Postgres ชั่วคราวใน Docker

| # | สถานการณ์ | ต้องตรวจ |
|---|---|---|
| 1 | สมัคร → เข้าหน้าภาพรวม | redirect ถูก, เห็น empty state |
| 2 | login ผิดรหัส | ข้อความ error ภาษาลาว, ไม่ redirect |
| 3 | บันทึกรายจ่าย 1 รายการ | ≤ 3 แตะ + พิมพ์เงิน, ยอดในภาพรวมเปลี่ยนตามจริง |
| 4 | บันทึกหลายรายการ 3 รายการ | ส่ง request เดียว, ยอดรวมถูก, ตะกร้าว่างหลังบันทึก |
| 5 | ตะกร้ามีรายการที่หมวดถูกลบไปแล้ว | API ตอบ `invalid_items`, ไฮไลต์ถูกรายการ, ไม่มีรายการไหนถูกบันทึก |
| 6 | บันทึกรายรับ + รายจ่าย แล้วดูรายงาน | summary, by-category %, budget ตรงกับข้อมูลที่ใส่ |
| 7 | แก้ไขและลบรายการ | รายการและยอดรวมอัปเดต |
| 8 | ตั้งงบ แล้วใช้เกินงบ | แถบเป็นสีแดง, แสดง "ເກີນ" พร้อมจำนวนที่ถูกต้อง |
| 9 | คัดลอกงบจากเดือนก่อน | จำนวนหมวดที่คัดลอกถูก |
| 10 | สร้างรายการประจำย้อนหลัง 2 เดือน | สร้างรายการย้อนหลังถูกจำนวนและถูกวันที่ |
| 11 | ลบหมวดที่มีรายการใช้อยู่ | ข้อความ 409 ภาษาลาวที่เข้าใจได้ |
| 12 | token หมดอายุหรือถูกลบ | กลับไปหน้า login |
| 13 | เปลี่ยนเดือนเร็วๆ หลายครั้ง | ข้อมูลที่แสดงตรงกับเดือนที่เลือกสุดท้ายเสมอ |
| 14 | ปิด backend ระหว่างใช้งาน | error state + ปุ่มลองใหม่, ไม่ crash |
| 15 | ทุกหน้าที่ 375px | ไม่มี horizontal scroll (`document.documentElement.scrollWidth <= 375`), ไม่มีตัวอักษรไทย |

### ความง่ายในการใช้งาน (usability)
ตรวจและรายงานเป็นตาราง:
- จำนวนแตะ/การพิมพ์ ของงานหลัก: บันทึก 1 รายจ่าย, บันทึก 5 รายจ่าย, ดูว่าเดือนนี้ใช้หมวดอาหารไปเท่าไร, ตั้งงบ 1 หมวด
- touch target ที่เล็กกว่า 44px
- contrast ที่ต่ำกว่า AA (light และ dark)
- รัน Lighthouse (mobile) บนหน้าภาพรวมและหน้าบันทึก: Performance, Accessibility ≥ 90
- ใช้ keyboard ล้วนได้บน desktop (focus มองเห็นได้, bottom sheet และ dialog trap focus และปิดด้วย Esc ได้)

---

## ส่วนที่ 3: บั๊กที่รู้แล้ว (ต้องแก้)

| # | ที่ | อาการ | แนวทางแก้ |
|---|---|---|---|
| 1 | `backend/internal/handlers/report_handler.go` `Summary` | "ช่วงก่อนหน้า" ใช้จำนวนวันเท่ากันย้อนหลัง ไม่ใช่เดือนก่อนจริง เช่น ต.ค. (31 วัน) เทียบกับ 31 ส.ค.–30 ก.ย. ทำให้ "ເດືອນກ່ອນ" ในหน้าภาพรวมผิด | ถ้า `from` เป็นวันที่ 1 และ `to` เป็นวันสุดท้ายของเดือนเดียวกัน ให้ previous เป็นเดือนปฏิทินก่อนหน้า กรณีอื่นใช้แบบเดิม เขียน Go test ด้วย |
| 2 | `backend` recurring `Update` | กดหยุดรายการประจำแล้วเปิดใหม่ ระบบสร้างรายการย้อนหลังของช่วงที่หยุดไว้ทั้งหมด (เพราะ `run_count` ไม่ขยับ) และไม่ generate ทันทีหลังเปิด | ตอนเปลี่ยน `active` จาก false เป็น true ให้ข้าม occurrence ที่เลยวันนี้ไปแล้ว (เลื่อน `run_count`/`next_run_date` ไปถึงครั้งถัดไปที่ ≥ วันนี้) เขียน Go test ด้วย |
| 3 | `frontend/src/lib/use-data.ts` | ตอนเปลี่ยนเดือนหรือ filter ยังแสดงข้อมูลชุดเก่าค้างไว้โดยไม่มีสัญญาณว่ากำลังโหลด ผู้ใช้อาจเข้าใจผิดว่าเป็นข้อมูลเดือนใหม่ | ให้ค่าที่คืนออกไปบอกด้วยว่า `data` เป็นของ key ไหน แล้วหน้าที่ใช้แสดง skeleton หรือทำให้จางลงเมื่อ key ไม่ตรงกัน |
| 4 | `frontend` หน้า `/transactions` | ช่องค้นหายิง API ทุกครั้งที่กดตัวอักษร | debounce 300ms |
| 5 | `frontend/src/components/trend-chart.tsx` | `min-w-[480px]` ทำให้จอมือถือต้องเลื่อนแนวนอน | ออกแบบกราฟใหม่ให้พอดี 375px |
| 6 | `frontend` หน้าบันทึก | UI ไม่จำกัด 100 รายการ (API จะตอบ 400) และ input รับทศนิยมเกิน 2 ตำแหน่ง (DB ปัดเศษเงียบๆ) | จำกัดใน UI และ validate ทศนิยม ≤ 2 |
| 7 | `frontend` `today()` เทียบกับ backend | frontend ใช้เวลาเครื่องผู้ใช้ ส่วน backend ใช้ `Asia/Vientiane` ถ้าเครื่องอยู่คนละ timezone จะได้ "วันนี้" ไม่ตรงกัน | ส่ง `txn_date` จาก frontend ทุกครั้ง แทนที่จะไม่ส่งเมื่อเป็นวันนี้ |
| 8 | `frontend` หน้าหมวด | ตั้งไอคอนหรือสีไม่ได้ และลบหมวดที่มีงบอยู่ งบจะถูกลบไปด้วยโดยไม่เตือน | เพิ่มตัวเลือกไอคอนและสี และเตือนก่อนลบถ้าหมวดมีงบอยู่ |
| 9 | `frontend` | ไม่มีหน้าแก้ไขรายการประจำ และไม่มีหน้าโปรไฟล์/เปลี่ยนรหัสผ่าน | ทำตามส่วนที่ 1 |

ถ้าเจอบั๊กอื่นระหว่างทำ ให้เพิ่มเข้าในรายงาน (ดูรูปแบบด้านล่าง) ถ้าเป็นบั๊ก frontend ให้แก้เลย ถ้าเป็นบั๊ก backend ให้รายงานอย่างเดียว

---

## สิ่งที่ต้องส่งมอบ

1. โค้ด frontend ใหม่ใน `frontend/` (และแก้ backend เฉพาะบั๊ก #1–#2)
2. test: `frontend/tests/e2e/*.spec.ts`, `frontend/src/**/*.test.ts` และ script `npm run test`, `npm run test:e2e` ใน `package.json`
3. `docs/qa-report.md` ประกอบด้วย:
   - ผลรัน test ทั้งหมด (จำนวน ผ่าน/ไม่ผ่าน พร้อม output ของตัวที่ไม่ผ่าน)
   - ตาราง usability (จำนวนแตะต่องาน ก่อน/หลัง, คะแนน Lighthouse)
   - ตารางบั๊ก: `# | ระดับ (สูง/กลาง/ต่ำ) | ที่ | วิธีทำให้เกิด | ผลที่ได้ | ผลที่ควรได้ | สถานะ (แก้แล้ว/รายงานอย่างเดียว)`
   - screenshot มือถือ (375px) ของทุกหน้า ทั้ง light และ dark ไว้ใน `docs/screenshots/`
4. อัปเดต `frontend/README.md`

## ลำดับการทำงานที่แนะนำ
1. อ่านโค้ดปัจจุบันและ docs ของ Next 16 → สรุปแผนสั้นๆ ก่อนเริ่ม
2. ตั้ง test infrastructure + เขียน e2e ของ flow หลัก (#1, #3, #4, #6) กับ UI เดิมก่อน เพื่อใช้กันไม่ให้ของเดิมพังระหว่างปรับ
3. แก้บั๊ก backend #1–#2 พร้อม Go test (`go test ./...` ต้องผ่าน)
4. ปรับ UI ทีละหน้า เริ่มจาก layout/nav → หน้าบันทึก → ภาพรวม → รายการ → งบ → รายการประจำ → หมวด → โปรไฟล์
5. เขียน test ที่เหลือ รันทั้งหมด แก้จนผ่าน
6. ทำ usability check + Lighthouse + screenshot → เขียน `docs/qa-report.md`

อย่าหยุดกลางทางเพื่อถามเรื่องที่ตัดสินใจเองได้ ให้เลือกทางที่สมเหตุสมผลแล้วจดเหตุผลไว้ในรายงาน ถามเฉพาะเรื่องที่ต้องให้เจ้าของระบบตัดสินใจจริงๆ
