#!/usr/bin/env bash
# Run ON THE SERVER to switch back to an earlier version loaded by release.sh.
#   ./rollback.sh            -> previous version
#   ./rollback.sh 20261006-0930
# The database is not rolled back; restore a backup separately if a release changed data.
set -euo pipefail
cd "$(dirname "$0")"
current="$(grep '^APP_TAG=' .env | cut -d= -f2)"
versions=($(docker images money-manager-backend --format '{{.Tag}}' | sort -r))
echo "available: ${versions[*]}   (running: $current)"

target="${1:-}"
if [ -z "$target" ]; then
  for v in "${versions[@]}"; do
    if [[ "$v" < "$current" ]]; then target="$v"; break; fi
  done
fi
[ -n "$target" ] || { echo "no older version available"; exit 1; }
docker image inspect "money-manager-frontend:$target" >/dev/null 2>&1 || { echo "version $target is not loaded"; exit 1; }

sed -i.bak "s/^APP_TAG=.*/APP_TAG=$target/" .env && rm -f .env.bak
docker compose up -d
echo "now running $target (was $current)"
