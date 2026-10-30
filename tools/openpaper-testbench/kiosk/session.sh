#!/bin/sh
set -eu
xset s off || true
xset -dpms || true
# Chromium needs a window manager to honor kiosk fullscreen. Without one it
# opens at 500x300+10+10, clipping the right edge of the 480x320 SPI display.
matchbox-window-manager -use_titlebar no -use_cursor no &
wm_pid=$!
attempts=0
until xprop -root _NET_SUPPORTING_WM_CHECK | grep -q 'window id'; do
  kill -0 "$wm_pid" || exit 1
  attempts=$((attempts + 1))
  [ "$attempts" -lt 100 ] || { echo 'Window manager did not become ready'; exit 1; }
  sleep 0.1
done
if [ -n "${TOUCH_DEVICE:-}" ] && [ -n "${TOUCH_MATRIX:-}" ]; then
  # Nine space-separated numbers, supplied after calibrating the actual panel.
  xinput set-prop "$TOUCH_DEVICE" 'Coordinate Transformation Matrix' $TOUCH_MATRIX
fi
until curl -fsS http://127.0.0.1:8080/healthz >/dev/null; do sleep 2; done
exec chromium --no-sandbox --kiosk --noerrdialogs --disable-session-crashed-bubble --disable-dev-shm-usage --disable-gpu --password-store=basic --user-data-dir=/tmp/chromium "${KIOSK_URL:-http://127.0.0.1:8080/touch.html}"
