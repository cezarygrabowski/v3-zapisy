#!/usr/bin/env bash
set -Eeuo pipefail
umask 0077
directory=/var/backups/elder-hub/daily
backup="$directory/elder-hub-$(date -u +%Y%m%dT%H%M%SZ).dump"
temporary="$backup.tmp"
trap 'rm -f "$temporary"' EXIT
pg_dump --dbname=elder_hub --format=custom --file="$temporary"
pg_restore --list "$temporary" > /dev/null
mv "$temporary" "$backup"
find "$directory" -name 'elder-hub-*.dump' -type f -mtime +13 -delete
