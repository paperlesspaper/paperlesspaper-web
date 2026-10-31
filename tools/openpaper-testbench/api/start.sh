#!/bin/sh
set -eu
# A live kernel device tree includes cameras plugged in after container startup.
# Keep Docker's pts/shm/console mounts intact when replacing its static /dev.
newdev=/run/live-dev
mkdir -p "$newdev"
mount -t devtmpfs devtmpfs "$newdev"
for name in console mqueue pts shm; do
  if mountpoint -q "/dev/$name"; then
    mount --move "/dev/$name" "$newdev/$name"
  fi
done
umount /dev
mount --move "$newdev" /dev
exec uvicorn app:app --host 0.0.0.0 --port "${PORT:-8080}" --no-proxy-headers --workers 1
