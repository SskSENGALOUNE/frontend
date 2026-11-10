#!/usr/bin/env bash
# Build the app images on THIS machine, upload them to the server and restart the app there.
# The server only needs Docker; it never sees the source code or builds anything.
#
#   SERVER=user@1.2.3.4 ./deploy/release.sh
#
# Options (env): REMOTE_DIR (default /opt/money-manager), PLATFORM (default linux/amd64;
# use linux/arm64 if `uname -m` on the server prints aarch64).
set -euo pipefail
: "${SERVER:?set SERVER, e.g. SERVER=user@1.2.3.4 ./deploy/release.sh}"
REMOTE_DIR="${REMOTE_DIR:-/opt/money-manager}"
PLATFORM="${PLATFORM:-linux/amd64}"
TAG="$(date +%Y%m%d-%H%M%S)"

cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

echo "==> 1/4 build images ($PLATFORM, version $TAG)"
docker build --platform "$PLATFORM" -t "money-manager-backend:$TAG" backend
docker build --platform "$PLATFORM" -t "money-manager-frontend:$TAG" frontend

echo "==> 2/4 export images"
docker save "money-manager-backend:$TAG" "money-manager-frontend:$TAG" | gzip > "$OUT/images.tar.gz"
echo "    $(du -h "$OUT/images.tar.gz" | cut -f1)"

echo "==> 3/4 upload to $SERVER:$REMOTE_DIR"
# Keepalives stop idle-looking links from being dropped; --partial lets a retry resume where it stopped.
SSH_OPTS="-o ServerAliveInterval=15 -o ServerAliveCountMax=8"
ssh $SSH_OPTS "$SERVER" "mkdir -p '$REMOTE_DIR/releases'"
upload() {
  for attempt in 1 2 3 4 5; do
    if rsync -az --partial --timeout=120 --progress -e "ssh $SSH_OPTS" "$@"; then return 0; fi
    echo "    upload interrupted (attempt $attempt/5), resuming in 5s..."
    sleep 5
  done
  echo "!! upload failed 5 times; check the connection and run release.sh again"
  return 1
}
upload "$OUT/images.tar.gz" "$SERVER:$REMOTE_DIR/releases/money-manager-$TAG.tar.gz"
upload deploy/docker-compose.yml deploy/Caddyfile deploy/backup.sh deploy/rollback.sh deploy/.env.example "$SERVER:$REMOTE_DIR/"

echo "==> 4/4 start on server"
ssh $SSH_OPTS "$SERVER" bash -s -- "$REMOTE_DIR" "$TAG" <<'REMOTE'
set -euo pipefail
cd "$1"
TAG="$2"
if [ ! -f .env ]; then
  echo "!! $1/.env is missing: run 'cp .env.example .env' on the server, fill in DB_PASSWORD and JWT_SECRET, then run release.sh again"
  exit 1
fi

gunzip -c "releases/money-manager-$TAG.tar.gz" | docker load

# back up before switching, if the database is already running
if [ -n "$(docker compose ps -q db 2>/dev/null)" ]; then ./backup.sh; fi

if grep -q '^APP_TAG=' .env; then sed -i.bak "s/^APP_TAG=.*/APP_TAG=$TAG/" .env && rm -f .env.bak; else echo "APP_TAG=$TAG" >> .env; fi
docker compose up -d --remove-orphans

echo "waiting for the API..."
for _ in $(seq 1 30); do
  if docker compose exec -T backend wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1; then
    docker compose ps
    break
  fi
  sleep 2
done
docker compose exec -T backend wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1 \
  || { echo "!! API did not become healthy; see: docker compose logs backend   (undo: ./rollback.sh)"; exit 1; }

# keep the 3 newest versions (files and images) for rollback
ls -1t releases/money-manager-*.tar.gz | tail -n +4 | xargs -r rm --
for repo in money-manager-backend money-manager-frontend; do
  docker images "$repo" --format '{{.Tag}}' | sort -r | tail -n +4 | xargs -r -I{} docker rmi "$repo:{}" >/dev/null
done
docker image prune -f >/dev/null
echo "deployed version $TAG"
REMOTE
