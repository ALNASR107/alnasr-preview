#!/usr/bin/env bash
# نسخة احتياطية يومية: سطور الشيت + جلسة واتساب + ملف البيئة
# crontab:  0 3 * * * /opt/amanah/deploy/backup.sh
set -euo pipefail
DEST="${BACKUP_DIR:-/opt/backups/amanah}"
mkdir -p "$DEST"
STAMP=$(date +%F-%H%M)
docker run --rm -v amanah-data:/data -v "$DEST":/backup alpine \
  tar czf "/backup/amanah-$STAMP.tar.gz" -C /data .
find "$DEST" -name 'amanah-*.tar.gz' -mtime +14 -delete
echo "✔ نسخة احتياطية: $DEST/amanah-$STAMP.tar.gz"
