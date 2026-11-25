#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Prefer a systemd timer; never run concurrently with deployment or database maintenance.
exec 9> .maintenance.lock
flock -n 9 || { echo 'Another maintenance operation is active'; exit 1; }
trap 'docker compose up -d app' EXIT
docker compose stop --timeout 45 app
docker compose run --rm -e APP_STOPPED_FOR_BACKUP=yes ops backup
