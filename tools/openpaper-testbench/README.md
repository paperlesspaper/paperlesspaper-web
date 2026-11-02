# OpenPaper Testbench

Eigenständige Balena-Anwendung für den Raspberry Pi 3B: USB-Webcam, kleines Touch-Menü, Netzwerkoberfläche, REST-API, optischer Referenzvergleich und potentialfreier Tastendruck am OpenPaper 7.

## Stand und Hardware

- Ziel: **Raspberry Pi 3B / raspberrypi3-64**, vom Benutzer bestätigt. Der Inventartitel „Pi 4“ ist unzutreffend.
- Inventar: https://inventory.paperlesspaper.de/inventory/inventory/be026967-aef3-414d-97f7-7629e5c5ed77
- Display: 480 × 320 über `piscreen`/ILI9486, Touch über ADS7846. Menü und Touchbedienung wurden am 29.10.2026 vom Benutzer bestätigt. Die genaue Handelsbezeichnung bleibt unbekannt.
- USB-Webcam: HD USB Camera (32e4:9230), `/dev/video0`, echte Bilder mit 1280 × 720 geprüft. Fotoaufnahme, Referenzvergleich und Wiederverbindung nach Treiber-Ab-/Anmeldung erfolgreich getestet.
- Balena-Flotte: https://dashboard.balena-cloud.com/fleets/2414149
- Flotten-Slug: `utzelb/openpaper-testbench`.
- GPIO bleibt bis zur fertigen Verdrahtung deaktiviert. Die API meldet das ausdrücklich.
- Live-Weboberfläche: http://192.168.178.75:8080 · API: http://192.168.178.75:8080/docs
- Release: `1.3.4`, `53b6970d5a1717bdc9496255f4957161` (4463627).
- Bei Versorgung über den Laptop wurde Unterspannung beobachtet; empfohlen sind stabile 5 V / 2,5 A.

## Erster Start

1. Das vorbereitete Image `openpaper-testbench-pi3-utzelb.img` aus `/Users/utzel/Downloads/openpaper-testbench/` mit Balena Etcher auf eine **separate microSD-Karte mit mindestens 8 GB** schreiben. Das Schreiben ersetzt den gesamten Karteninhalt. Die vorhandene Karte wurde bereits mit Zustimmung überschrieben; nur die alte Bootpartition wurde gesichert.
2. USB-Webcam und stabiles 5-V-/2,5-A-Micro-USB-Netzteil anschließen, Karte einsetzen, Pi starten.
3. Das WLAN `wirewireless` ist im Image hinterlegt; der Pi 3B benötigt ein 2,4-GHz-Netz. Alternativ Ethernet anschließen.
4. Im Balena-Dashboard auf `openpaper-testbench` warten. Die lokale IP steht auf der Geräteseite. Beim ersten Boot ist Internet zur Balena-Provisionierung erforderlich.
5. `http://<PI-IP>:8080` öffnen. Web-Passwort aus `web-password.txt` im gleichen Downloads-Ordner eingeben. Im Kiosk ist für Loopback-Zugriff kein Login nötig.
6. In „Status“ Kamera und ermittelte Auflösung prüfen. Bei mehreren Videogeräten `CAMERA_DEVICE` als Balena-Servicevariable für `testbench` setzen. Bei USB-Webcams mit mehreren Nodes den tatsächlichen Capture-Node verwenden (`v4l2-ctl --list-devices`).

Für den Online-Zugriff die HTTPS-Geräte-URL aus `online-url.txt` verwenden. Der Gateway-Dienst auf Port 80 schützt alle Daten mit Passwort/Sitzung oder API-Bearer-Token. Der direkte Port 8080 nutzt HTTP und ist ausschließlich für das vertrauenswürdige LAN gedacht. Keine Router-Portfreigabe erforderlich. WLAN- und Provisionierungsdaten liegen im Image; Image, Passwort und Token nicht veröffentlichen.

## Display in Betrieb nehmen

Die Weboberfläche ist bei **480 × 320** getestet. Alle Hauptseiten passen ohne Scrollen auf 480 × 320; zusätzlich bei 384 × 256 geprüft. Die Touch-Übersicht zeigt ausschließlich vier große Buttons für Webcam, Steuerung, Serial und Status, ohne Header. Auf Detailseiten bleibt der Header mit „Zurück“ oben links sichtbar. Die Webcam zeigt Livebild und eine feste Leiste mit Foto, Knopf und Vergleich. Der Status ist auf Kamera, Stromversorgung, Knopf und Temperatur gekürzt; technische Details bleiben über die API verfügbar. Fotoaufnahme meldet den Erfolg kurz im Bild, gespeicherte Fotos sind über `/api/photos` abrufbar. Der Bildausschnitt hat eine eigene kompakte Eingabeseite. Detailseiten haben oben links „Zurück“; der Bildvergleich ist eine Unterseite der Webcam. Es gibt keine Tabs. Die Chromium-Richtlinie `TranslateEnabled=false` im Kiosk unterbindet Übersetzungsangebote. Die Seite ist zusätzlich mit `translate="no"` und `google: notranslate` gekennzeichnet. Bei UI-Updates auch das Kiosk-Label `com.paperlesspaper.ui-version` erhöhen, damit Chromium die neue Oberfläche lädt. Der Kiosk unterstützt Xorg mit DRM oder Linux-Framebuffer:

- `FRAMEBUFFER=auto`: `/dev/fb1` bevorzugen, dann ILI9486 auf `/dev/fb0`, sonst DRM `/dev/dri/card0`, sonst `/dev/fb0`.
- `FRAMEBUFFER=/dev/fb1`: SPI-Framebuffer explizit auswählen, nachdem der passende Hosttreiber ihn angelegt hat.
- `FRAMEBUFFER=drm`: Xorg den DRM-Ausgang erkennen lassen.
- `TOUCH_DEVICE` und `TOUCH_MATRIX`: optionaler XInput-Gerätename und neun Werte der Koordinatentransformation, nach tatsächlicher Kalibrierung.

Aktives und im Image enthaltenes Profil:

```ini
dtoverlay=vc4-kms-v3d,cma-320
dtoverlay=piscreen,speed=16000000,rotate=270,fps=15
```

Die Balena-Flottenkonfiguration `RESIN_HOST_CONFIG_dtoverlay` enthält entsprechend:

```text
"vc4-kms-v3d,cma-320","piscreen,speed=16000000,rotate=270,fps=15"
```

Dauerhafte Servicevariablen für `kiosk` in dieser Flotte:

```text
TOUCH_DEVICE=ADS7846 Touchscreen
TOUCH_MATRIX=1 0 0 0 -1 1 0 0 1
```

Die Y-Achse wird dadurch gespiegelt. Der Benutzer hat die korrigierte Touchbedienung bestätigt. Xorg nutzt `/dev/fb0` mit 480 × 320 und erkennt ADS7846 als Eingabegerät. Matchbox stellt den echten Vollbildmodus für Chromium bereit. Ohne Fenstermanager öffnete Chromium trotz `--kiosk` ein 500 × 300 großes Fenster bei Position +10,+10; die rechte Kante lag außerhalb des Panels. Der Kiosk wartet deshalb vor dem Browserstart auf den Fenstermanager. Bei einer neuen Flotte diese beiden Servicevariablen übernehmen. Das Profil ist für diesen Aufbau verifiziert, nicht für beliebige blaue Displayplatinen.

Prüfen in der Balena-Hostkonsole:

```sh
cat /proc/fb
cat /proc/bus/input/devices
cat /sys/class/graphics/fb0/virtual_size
```

Keine `LCD-show`-Installationsskripte für Raspberry Pi OS auf balenaOS ausführen. Das Gerät vor dem Abziehen der Displayplatine ausschalten.

## OpenPaper-Knopf elektrisch betätigen

Vorgesehen ist ein **3,3-V-kompatibler, potentialfreier Schaltkontakt** (PhotoMOS oder geeignetes Relaismodul mit Treiber). Dessen zwei Ausgangskontakte parallel an die beiden tatsächlich unterschiedlichen Kontakte des rückseitigen OpenPaper-Tasters löten. Der Taster bleibt dadurch manuell bedienbar. Bei vierbeinigen Tastern sind jeweils zwei Beine oft bereits intern verbunden: die beiden Schaltseiten mit einem Durchgangsprüfer bestimmen.

```text
Raspberry Pi                     Isoliertes Schaltmodul        OpenPaper 7
BCM26 / physischer Pin 37  ----->  IN
GND   / physischer Pin 39  ----->  GND
3,3 V / Pin 1 (falls nötig) ---->  VCC (nur 3,3-V-kompatibel!)
                                 Kontakt A  ----------------  Tasterseite A
                                 Kontakt B  ----------------  Tasterseite B
```

- **Nie 3,3 V/5 V oder GPIO direkt auf den OpenPaper-Taster legen.** Keine direkte Masseverbindung zur OpenPaper-Seite nötig, wenn der Kontakt wirklich potentialfrei ist.
- Keine Relaisspule direkt mit GPIO treiben. Modul mit geeignetem Treiber verwenden; bei diskreter PhotoMOS-Beschaltung LED-Vorwiderstand nach Datenblatt auslegen.
- GPIO26/Pin37 ist ein vorgeschlagener Pin außerhalb eines üblichen 26-Pin-Displaysteckers. Vor dem Löten die tatsächliche Displaybelegung und mechanische Zugänglichkeit prüfen.
- Für einen active-high-Eingang einen 10-kΩ-Pulldown am Steuereingang vorsehen; er hält den Kontakt während Boot/Neustart offen. Bei active-low entsprechend elektrisch auf inaktiv ziehen und `BUTTON_ACTIVE_LOW=1` einstellen.
- Erst nach Verdrahtungsprüfung `BUTTON_ENABLED=1` in Balena setzen. Standardimpuls 250 ms, erlaubt 50–3000 ms, eine Sekunde Pause zwischen abgeschlossenen Impulsen. Ein zweiter gleichzeitiger Aufruf wird abgelehnt. Die Software setzt den Ausgang im Fehlerpfad zurück; bei Stromausfall/SIGKILL muss die externe Beschaltung den inaktiven Zustand sicherstellen.

## API

Basis: `http://<PI-IP>:8080`. Interaktive Dokumentation: `/docs`; Schema: `/openapi.json`. Bei Netzwerkzugriff `Authorization: Bearer <API_TOKEN>` senden. Im Browser wird nach Eingabe des separaten Web-Passworts eine zwölf Stunden gültige Sitzung mit HttpOnly-/SameSite-Cookie angelegt; online zusätzlich Secure. Abmelden widerruft die Sitzung. Schreibzugriffe aus einer fremden Website werden abgewiesen.

| Methode | Pfad | Funktion |
| --- | --- | --- |
| GET | `/healthz` | Prozess erreichbar, ohne Authentifizierung; kein Hardware-Gesundheitsnachweis |
| GET | `/api/status` | Kamera, Bildalter, GPIO, Temperatur, Unterspannung, Speicher, IP-Adressen, Framebuffer |
| GET | `/api/camera.jpg` | Aktuelles JPEG; fehlende/veraltete Kamera ergibt 503 |
| GET | `/api/stream.mjpg` | MJPEG-Livestream |
| POST | `/api/photos` | Foto persistent speichern; JSON mit ID und Download-URL |
| GET | `/api/photos` | Gespeicherte Fotos auflisten |
| GET | `/api/photos/{id}` | Foto herunterladen |
| POST | `/api/button/press` | `{"duration_ms":250}` |
| POST | `/api/reference` | Aktuelles Bild und Ausschnitt als Referenz speichern |
| POST | `/api/analyze` | Aktuelles Bild mit gespeicherter Referenz vergleichen |

```sh
export TESTBENCH_URL=http://192.168.1.123:8080
read -r TESTBENCH_TOKEN < /Users/utzel/Downloads/openpaper-testbench/api-token.txt
curl -H "Authorization: Bearer $TESTBENCH_TOKEN" "$TESTBENCH_URL/api/status"
curl -X POST -H "Authorization: Bearer $TESTBENCH_TOKEN" \
  -H 'Content-Type: application/json' -d '{"duration_ms":250}' \
  "$TESTBENCH_URL/api/button/press"
curl -X POST -H "Authorization: Bearer $TESTBENCH_TOKEN" "$TESTBENCH_URL/api/photos"
curl -X POST -H "Authorization: Bearer $TESTBENCH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"region":{"x":0.15,"y":0.1,"width":0.7,"height":0.8}}' \
  "$TESTBENCH_URL/api/reference"
curl -X POST -H "Authorization: Bearer $TESTBENCH_TOKEN" \
  -H 'Content-Type: application/json' -d '{"max_difference":0.05}' \
  "$TESTBENCH_URL/api/analyze"
```

Der Vergleich liefert mittlere Grauwertabweichung (0–1), veränderten Pixelanteil, Helligkeit und Schärfemaß. `matches_reference` bezieht sich auf die mittlere Abweichung, standardmäßig höchstens 5 %. Kein OCR, keine semantische Bildbewertung und keine interne OpenPaper-Telemetrie. Feste Kameraposition, gleiche Beleuchtung und ein auf das E-Paper begrenzter Bildausschnitt sind nötig. Nach einem E-Paper-Refresh bis zum vollständig aufgebauten Bild warten; während des Refreshs ist die Abweichung erwartbar. Bei geänderter Kameraauflösung muss die Referenz erneuert werden.

Fotos/Referenz bleiben im Balena-Volume `captures` erhalten. Automatisch werden die neuesten 200 Fotos behalten (`MAX_PHOTOS` änderbar). Knopfzähler und Prozesslaufzeit beginnen bei Neustart neu.

## Entwicklung und Deployment

```sh
cd tools/openpaper-testbench
python3.11 -m venv .venv
.venv/bin/pip install -r api/requirements.txt pytest httpx
.venv/bin/pytest -q tests
cd api
DEMO_MODE=1 BUTTON_ENABLED=1 DATA_DIR=/tmp/openpaper-demo \
  ../.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8097 --no-proxy-headers
```

`DEMO_MODE=1` zeigt ausschließlich synthetische Bilder und simuliert den Knopf; nie in der echten Flotte setzen. Uvicorn muss mit genau einem Worker und ohne Proxy-Header laufen, weil Kamera/GPIO nur einen Eigentümer haben dürfen und Loopback Zugriff ohne Token erlaubt.

```sh
balena push utzelb/openpaper-testbench --source tools/openpaper-testbench
```

Nur dieses Unterverzeichnis hochladen. WLAN, Token und Image liegen außerhalb des Repositories. Normale Updates ändern ausschließlich die eigene Test-Flotte.

## Quellen

- Balena CLI: https://docs.balena.io/reference/balena-cli/
- balenaOS-Konfiguration: https://docs.balena.io/reference/os/configuration/
- Pi 3B: https://www.raspberrypi.com/products/raspberry-pi-3-model-b/
- Verwendetes PiScreen-Overlay: https://github.com/raspberrypi/linux/blob/rpi-6.12.y/arch/arm/boot/dts/overlays/piscreen-overlay.dts
- Vergleichbares Display und Pinbelegung: https://www.berrybase.de/3-5-display-fuer-raspberry-pi-mit-resistivem-touchscreen

## USB-Relais und Serial (v1.1.0)

Die Übersicht bietet Webcam, Steuerung, Serial und Status. Alle Detailseiten haben
oben links Zurück. Die neue Oberfläche ist für 480 × 320 Pixel ausgelegt.

- LCUS-1 / CH340 (`1a86:7523`), 9600 Baud, COM/NC in der Rahmenversorgung.
  `A0 01 00 A1` = Strom an, `A0 01 01 A2` = Strom aus.
  Grundlage: [Firmware-Testbench](https://github.com/paperlesspaper/paperlesspaper-firmware/blob/main/testbench/hardware_controller.py).
- Separater CP210x (`10c4:ea60`) am OpenPaper, 115200 Baud, 8N1.
  Der Leser bleibt während Relaisaktionen offen und verbindet sich nach USB-Abziehen
  automatisch neu. Es werden keine UART-Daten geschrieben und keine DTR/RTS-Resets ausgelöst.
- `RELAY_ENABLED=1` aktiviert das NC-Profil. Bei mehreren gleichartigen Adaptern
  `RELAY_DEVICE` bzw. `SERIAL_DEVICE` explizit setzen; die USB-Kennung wird trotzdem geprüft.
  `SERIAL_BAUDRATE` ist standardmäßig 115200.
- Es gibt keine elektrische Rückmeldung des Relais. Angezeigt wird nur der letzte
  gesendete Strombefehl, nach Start/Fehler ist der Zustand unbekannt.
- Neustart: 250 Millisekunden stromlos, danach Strom an. Reset 6×: exakt sechs solcher
  Unterbrechungen mit jeweils 1,5 Sekunden eingeschalteter Versorgung dazwischen.
  **Das kann WLAN- und Aktivierungsdaten löschen.** Die UI zeigt vorher eine
  Bestätigungsseite. Dies ist kein verifizierter Factory-Reset: Die Firmware-Testbench
  verwendet dafür mindestens sechs Zyklen und prüft anschließend UART-Meldungen.
- Ein Lock verhindert überlappende Relaisaktionen (HTTP 409). Auch bei Fehlern wird
  versucht, Strom wieder einzuschalten; bei abgezogenem Relais ist das nicht garantiert.
- UART-Ringpuffer: maximal 2000 Zeilen à 2048 Bytes im RAM, UTC-Zeitstempel und laufende
  IDs; Neustart des Testbench-Dienstes leert ihn. Die WebUI zeigt die letzten 1000
  abgerufenen Zeilen, aktualisiert jede Sekunde und bietet Pause/Weiter und Log-Download.
  Authentifizierung wie bei Kamera und anderen APIs; Logs werden nicht öffentlich freigegeben.

Neue API-Endpunkte (Bearer-Token wie oben):

| Methode | Pfad | JSON / Parameter |
| --- | --- | --- |
| POST | `/api/power` | `{"on":true}` bzw. `{"on":false}` |
| POST | `/api/reset` | `{"count":1}` |
| POST | `/api/reset` | `{"count":6,"confirm_data_loss":true}` |
| GET | `/api/serial` | `?after=0&limit=200` (max. 2000) |
| GET | `/api/serial.txt` | Aktueller Puffer als Textdownload |
| GET | `/api/status` | Zusätzlich `relay` und `serial` |

`/api/serial` liefert `session`, `lines` (id, at, text), `next_cursor`, `truncated`
und `status`. Bei geänderter `session` den Cursor auf 0 zurücksetzen. `truncated=true`
zeigt eine Lücke durch einen überlaufenen Puffer an. Ein offener UART-Port bedeutet
nicht, dass gerade Firmware-Ausgabe anliegt; siehe `last_received`.

## Getrennte Oberflächen (v1.1.1)

- **Browser-Dashboard:** `http://<Pi-IP>:8080/`. Webcam, Relaissteuerung,
  Serial-Konsole mit Filter/Autoscroll/Pause/Download, Diagnosewerte und
  Bildvergleich mit Ausschnittseinstellungen. Die 6×-Sequenz erfordert das
  bewusste Aktivieren von „Datenverlust ist beabsichtigt“.
- **Touch-Oberfläche:** `http://<Pi-IP>:8080/touch.html`. Vier große Menüpunkte,
  getrennte Detailseiten und Zurück oben links. Startet automatisch auf dem Pi.
  Auf 480×320 und 384×256 ohne Seitenüberlauf geprüft.
- Beide Oberflächen verwenden dieselbe geschützte API. Es gibt keine Freigabe
  allein aufgrund der gewählten Oberfläche; Web-Anmeldung oder API-Bearer-Token
  bleiben für Zugriffe aus dem Netzwerk erforderlich.

## Impulszeiten und Hardwareprüfung (v1.1.3)

Reset sendet jetzt 250 ms Stromunterbrechung; bei fünf Impulsen liegen jeweils
1500 ms eingeschaltete Versorgung zwischen Impulsende und nächstem Impulsstart.
API-Antwort: `off_ms=250`, `interval_ms=1500`.

Am 29.10.2026 wurde der CP210x verbunden und Firmware 3.0.45 über UART gelesen.
250, 500 und 750 ms Stromunterbrechung lieferten keine neuen Boot-Meldungen.
Ein Vergleich mit 3 Sekunden lieferte dagegen eine neue INIT-Meldung; während
der Unterbrechung verschwand auch der UART. Deshalb heißt die kurze Aktion
„Reset-Impuls“ und bestätigt nur die gesendete Schaltfolge, keinen Neustart.
Für kurze echte Tastendrücke ist eine separate Beschaltung des Tasterkontakts
erforderlich; das derzeitige NC-Profil ist ausschließlich für die Versorgung.

## USB-Wechsel während Reset-Folgen (v1.1.4)

Bei schnellem USB-Hotplug kann pyserial einen Port bereits sehen, dessen
`idVendor`/`idProduct` gerade nicht mehr existiert. Die dabei auftretenden
TypeError/ValueError werden nun als vorübergehende Erkennungsfehler behandelt.
Der Serial-Leser versucht nach 200 ms erneut zu verbinden und übersteht auch
Fehler beim Schließen eines bereits entfernten Geräts. Die normalen Impulszeiten
bleiben 250 ms mit 1500 ms Pause; 50 ms / 1000 ms wurde separat als Hardwaretest
angefordert, ohne die normalen Einstellungen zu ändern.


## Passwortgeschützter Online-Zugriff (v1.2.1)

Der Balena Public Device URL leitet HTTPS-Anfragen an den nginx-Dienst `gateway`
auf Port 80 des Pi weiter. Dieser setzt stets `X-Testbench-Public: 1` und leitet
an Port 8080 weiter. Der Backend-Dienst akzeptiert bei solchen Anfragen niemals
die lokale Kiosk-Ausnahme, auch nicht bei gefälschtem Host-Header. Uvicorn bleibt
mit `--no-proxy-headers` konfiguriert. Den Gateway-Marker nicht entfernen.

- Anmeldung: nur Passwort, kein Benutzername, über `/login.html`.
- Immer die HTTPS-Adresse verwenden. Balena liefert dem Pi keinen verlässlichen
  Header zum ursprünglichen Protokoll. Deshalb setzt der Gateway HSTS; die
  Login-Seite leitet öffentliche HTTP-Aufrufe im Browser vor Anzeige des Formulars
  auf HTTPS um. Ein nativer HTTP-Client wird nicht automatisch umgeleitet.
  Secure-Sitzungscookies werden ausschließlich über HTTPS übertragen.
- Web-Passwort: lokal in `web-password.txt`; ausschließlich der scrypt-Hash steht
  in der Geräte-Servicevariable `WEB_PASSWORD_HASH` des Dienstes `testbench`.
- Server verwaltet zufällige Sitzungen im RAM, maximal zwölf Stunden. Abmeldung
  oder Dienstneustart beendet sie. Das API-Token bleibt davon getrennt.
- Fünf Anmeldeversuche pro Minute; Online-Anfragen teilen wegen des Balena-Proxys
  ein Limit. Nach Fehlversuchen eine Minute warten.
- Ohne Anmeldung sind nur Login-Seite, deren CSS/JS und `/api/login` erreichbar.
  Kamera, Fotos, Logs, Status, API-Schema und Steuerung bleiben geschützt.
- `POST /api/login` erwartet `{"password":"…"}` und `X-Testbench: 1`.
  `POST /api/logout` widerruft die aktuelle Browser-Sitzung.
- Automatisierungen nutzen weiter `Authorization: Bearer <API_TOKEN>` und
  dieselben API-Pfade unter der öffentlichen HTTPS-Adresse.
- Das lokale Touch-Menü über `127.0.0.1:8080` benötigt keine Anmeldung.
- Pi und Internetverbindung müssen eingeschaltet bleiben.

Zum Ändern des Passworts mit `auth.hash_password()` einen neuen scrypt-Hash
berechnen und `WEB_PASSWORD_HASH` ersetzen. Dadurch startet der Dienst neu und
bestehende Sitzungen werden ungültig. Keine Klartext-Passwörter ins Repository
oder in die Compose-Datei schreiben.


## Reset-Sequenz (v1.2.2)

Der Reset-Button sendet jetzt sechs Impulse. Touch-Menü und Browser-Dashboard
verwenden `POST /api/reset` mit `{"count":6,"confirm_data_loss":true}`.
Die API erlaubt einen einzelnen Impuls oder sechs Impulse; `count=5` wird
abgewiesen. Dauer und Pausen bleiben bei 250 ms aus und 1500 ms eingeschaltet
zwischen den Impulsen. Der Rahmen bleibt am Ende eingeschaltet.

## Native Kameraeinstellungen und Nachtaufnahmen (v1.3.0)

Das Browser-Dashboard bietet unter „Kamera einstellen“ native V4L2-Regler für
Helligkeit, Kontrast, Verstärkung, Belichtungsautomatik, Belichtungszeit und
variable Bildrate, soweit die angeschlossene Kamera diese unterstützt. Die
Werte werden direkt im Gerät gesetzt und zurückgelesen. Einstellungen überleben
Dienstneustarts; „Ausgangswerte“ lädt den zuerst gespeicherten gültigen Zustand.
Einige UVC-Werkseinstellungen dieser Webcam sind außerhalb des gültigen Bereichs
und werden deshalb nicht zum Zurücksetzen verwendet.

Für die vorhandene HD USB Camera (32e4:9230) meldet der Treiber:

- Helligkeit −64 bis 64, Kontrast 0 bis 64, Verstärkung 0 bis 100.
- Belichtung 1 bis 5000 Einheiten à 100 µs, entsprechend 0,1 bis 500 ms.
- Automatikmodus 3 und manuelle Belichtung mit Modus 1.
- Die tatsächliche Sensorzeit kann zusätzlich durch die Bildrate begrenzt sein;
  die Treibergrenze ist keine Messung der physikalischen Belichtungsdauer.

„Nachtprofil“ speichert maximale gemeldete manuelle Belichtung plus maximale
Verstärkung. „Nachtfoto aufnehmen“ aktiviert dieses Profil nur vorübergehend,
wartet zwei Sekunden auf die Kamera und mittelt anschließend frische Bilder über
die gewählte Sammeldauer. Dies reduziert Rauschen; es ist keine einzelne lange
Sensorbelichtung und ersetzt fehlendes Licht nicht. Bewegungen können verwischen.
Die Aufnahme läuft im Hintergrund mit konstantem Speicherbedarf, maximal fünf
Bildern pro Sekunde und maximal 60 Sekunden. Einstellungen werden auch nach
Abbruch oder Aufnahmefehler bestmöglich wiederhergestellt; Wiederherstellungsfehler
werden ausdrücklich angezeigt. Beim Dienststart werden gespeicherte Werte erneut
angewendet. Während der Aufnahme sind weitere Kameraänderungen gesperrt.

| Methode | Pfad | Bedeutung / Body |
|---|---|---|
| GET | `/api/camera/controls` | Unterstützte Regler, aktuelle Werte, Grenzen |
| POST | `/api/camera/controls` | `{"values":{"brightness":8,"contrast":36}}` |
| POST | `/api/camera/controls` | `{"values":{"auto_exposure":1,"exposure_time_absolute":5000}}` |
| POST | `/api/camera/restore` | Gesicherte Ausgangswerte laden |
| POST | `/api/camera/night-profile` | Nachtprofil dauerhaft wählen |
| POST | `/api/camera/night` | `{"seconds":10}`; antwortet 202, startet Hintergrundaufnahme |
| GET | `/api/camera/night` | Fortschritt, Ergebnis-URL und mögliche Fehler |
| POST | `/api/camera/night/cancel` | Laufende Aufnahme abbrechen |

Die API verwendet native Ganzzahlen; die WebUI zeigt Belichtungszeit in ms.
Der Nachtjob meldet `method=frame_average`, `frames`, `native_exposure_ms` und
`result.url`. Einzelne Fotos und Nachtfotos teilen die bestehende begrenzte
Fotogalerie. Alle neuen Endpunkte sind durch die vorhandene Anmeldung bzw. den
API-Bearer-Token geschützt. Referenzbilder nach Änderungen an der Kamera bei
Bedarf neu aufnehmen, damit der Bildvergleich unter gleichen Bedingungen erfolgt.

Referenz für V4L2-Belichtungseinheiten und Bildratenbegrenzung:
https://docs.kernel.org/userspace-api/media/v4l/ext-ctrls-camera.html

Hardwareprüfung am 29.10.2026: Helligkeit 8, Kontrast 36 und manuelle 20 ms
über die Online-WebUI gesetzt und per API zurückgelesen. Danach Ausgangswerte
wiederhergestellt. Nachtaufnahme über 5 Sekunden lieferte 7 frische Bilder,
ein JPEG mit 1280 × 720 und bestätigte danach alle sechs ursprünglichen
Reglerwerte. Der Sensor war dabei auf 500 ms und Verstärkung 100 gesetzt.

## Großer Stromschalter (v1.3.1)

Touch-Menü und Browser-Dashboard verwenden einen großen Ein-/Aus-Schalter.
Er zeigt den letzten erfolgreichen Schaltbefehl; das Relais liefert weiterhin
keine elektrische Rückmeldung. Bei unbekanntem Zustand schaltet die erste
Betätigung gezielt ein. Während laufender Aktionen und bei fehlendem Relais
ist der Schalter gesperrt.

## paperlesspaper-Gestaltung (v1.3.2)

Dashboard, Login und Touch-Menü verwenden das Markenblau `#104aa1` von
https://paperlesspaper.de/ mit neutralen weißen/hellgrauen Flächen. Das originale
SVG-Logo wurde am 30.10.2026 aus dem Website-Header übernommen und liegt lokal
als `api/static/paperlesspaper-logo.svg`; seine Pfadgeometrie bleibt unverändert.
Auf dem Touchdisplay erscheint es in der Übersicht. Das öffentliche Logo ist
auch vor der Anmeldung verfügbar; Kamera und Steuerung bleiben geschützt.
