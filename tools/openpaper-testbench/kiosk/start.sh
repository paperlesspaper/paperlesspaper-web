#!/bin/sh
set -eu
mkdir -p /tmp/.X11-unix /run/dbus
dbus-daemon --system --fork 2>/dev/null || true
# Populate the container's udev database so Xorg/libinput discovers touch input.
/lib/systemd/systemd-udevd --daemon
udevadm trigger --subsystem-match=input --action=add
udevadm trigger --subsystem-match=drm --action=add
udevadm settle --timeout=10 || true
fb="${FRAMEBUFFER:-auto}"
if [ "$fb" = auto ]; then
  if [ -e /dev/fb1 ]; then fb=/dev/fb1;
  elif [ -e /dev/fb0 ] && grep -q 'ili9486' /sys/class/graphics/fb0/name; then fb=/dev/fb0;
  elif [ -e /dev/dri/card0 ]; then fb=drm;
  else fb=/dev/fb0; fi
fi
if [ "$fb" != drm ]; then
  case "$fb" in /dev/fb[0-9]) ;; *) echo 'Invalid FRAMEBUFFER'; exit 1;; esac
  until [ -e "$fb" ]; do echo "Waiting for framebuffer $fb (display overlay required)"; sleep 10; done
  cat > /etc/X11/xorg.conf <<EOF
Section "Device"
  Identifier "TouchDisplay"
  Driver "fbdev"
  Option "fbdev" "$fb"
EndSection
Section "Screen"
  Identifier "Screen"
  Device "TouchDisplay"
  DefaultDepth 16
EndSection
EOF
fi
exec xinit /app/session.sh -- :0 -nolisten tcp -nocursor -ac
