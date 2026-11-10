#!/usr/bin/env bash
# Dumps the database to deploy/backups/money_manager-YYYYmmdd-HHMM.sql.gz and keeps the last 14.
# Cron example (daily 02:30):  30 2 * * * /opt/money-manager/deploy/backup.sh >> /var/log/money-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
file="backups/money_manager-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U money --clean --if-exists money_manager | gzip > "$file"
ls -1t backups/money_manager-*.sql.gz | tail -n +15 | xargs -r rm --
echo "saved $file ($(du -h "$file" | cut -f1))"
