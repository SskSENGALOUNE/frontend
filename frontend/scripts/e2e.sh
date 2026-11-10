#!/usr/bin/env bash
# Runs the Playwright suite against a throwaway Postgres (Docker) and a fresh backend build.
# Never touches the real money_manager database. Usage: scripts/e2e.sh [playwright args]
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(cd .. && pwd)"
PG=mm-e2e-pg
PG_PORT=55998
API_PORT=18081

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  docker rm -f "$PG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$PG" >/dev/null 2>&1 || true
docker run -d --rm --name "$PG" -e POSTGRES_PASSWORD=test -p "$PG_PORT:5432" postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do docker exec "$PG" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1

(cd "$ROOT/backend" && go build -o bin/server ./cmd/server)
(cd "$ROOT/backend" && DB_PORT=$PG_PORT DB_PASSWORD=test APP_PORT=$API_PORT JWT_SECRET=e2e-secret ./bin/server >/tmp/mm-e2e-backend.log 2>&1) &
API_PID=$!
for _ in $(seq 1 30); do curl -sf "localhost:$API_PORT/health" >/dev/null && break; sleep 1; done

# The API proxy target is baked in at build time, so always build a separate copy aimed at the
# test backend, and refuse to run if it points anywhere else (e.g. the real backend on :8080).
NEXT_DIST_DIR=.next-e2e BACKEND_URL="http://localhost:$API_PORT" npx next build >/tmp/mm-e2e-build.log 2>&1
if ! grep -q "localhost:$API_PORT/api/v1" .next-e2e/routes-manifest.json || grep -q "localhost:8080" .next-e2e/routes-manifest.json; then
  echo "e2e build does not point at the test backend (localhost:$API_PORT); refusing to run" >&2
  exit 1
fi
if [[ -n "${E2E_CMD:-}" ]]; then
  E2E_DIST=.next-e2e eval "$E2E_CMD"   # e.g. E2E_CMD="node scripts/lighthouse.mjs"
else
  npx playwright test "$@"
fi
