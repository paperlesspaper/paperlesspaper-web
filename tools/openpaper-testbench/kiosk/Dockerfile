FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium matchbox-window-manager xserver-xorg-core xserver-xorg-video-fbdev xserver-xorg-video-modesetting xserver-xorg-input-libinput xinit x11-xserver-utils x11-utils xinput dbus-x11 udev fonts-dejavu curl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY start.sh session.sh /app/
COPY policies/openpaper.json /etc/chromium/policies/managed/openpaper.json
RUN chmod +x /app/*.sh
CMD ["/app/start.sh"]
