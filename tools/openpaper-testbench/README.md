# OpenPaper Testbench

Eigenständige Balena-Anwendung für den Raspberry Pi 3B: mehrere Rahmen mit zugeordneten USB-Webcams/Relais/UARTs, Endoskop-Detailansicht, NEEWER-Beleuchtung mit Automatik und dauerhaftem Ein/Aus, Touch-Menü, REST-API und perspektivisch entzerrter Referenzvergleich.

## Stand und Hardware

- Ziel: **Raspberry Pi 3B / raspberrypi3-64**, vom Benutzer bestätigt. Der Inventartitel „Pi 4“ ist unzutreffend.
- Inventar: https://inventory.paperlesspaper.de/inventory/inventory/be026967-aef3-414d-97f7-7629e5c5ed77
- Display: 480 × 320 über `piscreen`/ILI9486, Touch über ADS7846. Menü und Touchbedienung wurden am 29.10.2026 vom Benutzer bestätigt. Die genaue Handelsbezeichnung bleibt unbekannt.
- USB-Webcam: HD USB Camera (32e4:9230), `/dev/video0`, echte Bilder mit 1280 × 720 geprüft. Fotoaufnahme, Referenzvergleich und Wiederverbindung nach Treiber-Ab-/Anmeldung erfolgreich getestet.
- Balena-Flotte: https://dashboard.balena-cloud.com/fleets/2414149
- Flotten-Slug: `utzelb/openpaper-testbench`.
- GPIO bleibt bis zur fertigen Verdrahtung deaktiviert. Die API meldet das ausdrücklich.
- Live-Weboberfläche: http://192.168.178.75:8080 · API: http://192.168.178.75:8080/docs
- Release: **1.8.5**, `33bada0fa00823ee237c193593c8343c` (4487047), am 08.11.2026 installiert. Zuordnungsänderungen beim Rahmenwechsel gesichert, robustere gemerkte Anmeldung und epd-Profilnamen.
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

Basis: `http://<PI-IP>:8080`. Interaktive Dokumentation: `/docs`; Schema: `/openapi.json`. Bei Netzwerkzugriff `Authorization: Bearer <API_TOKEN>` senden. Im Browser wird nach Eingabe des separaten Web-Passworts eine Sitzung mit HttpOnly-/SameSite-Cookie angelegt; online zusätzlich Secure. Die vorausgewählte Option „Angemeldet bleiben“ gilt 30 Tage und übersteht Dienst-/Pi-Neustarts; ohne diese Option endet die Sitzung spätestens nach zwölf Stunden und wird nicht dauerhaft gespeichert. Der Sitzungsspeicher unter `/data/web-sessions.json` enthält nur Token-Hashes, ist mit Dateirechten 0600 geschützt und wird bei Änderung des Passwort-Hashes ungültig. Abmelden widerruft die Sitzung. Schreibzugriffe aus einer fremden Website werden abgewiesen.

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

## Kameralast und Ruhemodus

Die Geräteübersicht liest Kameranamen und primäre Video-Knoten aus sysfs, ohne
die Kameras per `v4l2-ctl --all` zu öffnen. Damit blockieren hängende USB-Anfragen
nicht die Geräteerkennung. Die Oberfläche lädt gespeicherte Zuordnungen zuerst;
Geräteerkennung und Lampenstatus laufen unabhängig davon und haben einen
Zeitablauf. Nicht erreichbare Geräte behalten ihre gespeicherte Zuordnung.

Die Kamera wird durch Bildabrufe aktiviert, nicht durch Statusabfragen. Nach
15 Sekunden ohne Bildabruf schließt der Dienst die USB-Aufnahme. Ein neuer
Bildabruf weckt sie auf und wartet bis zu acht Sekunden auf ein frisches Bild.
Ausgeblendete Browserfenster rufen keine Livebilder mehr ab.

Für die Liveansicht gelten `CAMERA_FPS=2`, `CAMERA_PREVIEW_WIDTH=1280` und
`CAMERA_PREVIEW_HEIGHT=720`. Die Aufnahme wählt eine von der Kamera angebotene
MJPEG-Auflösung innerhalb dieser Grenzen mit dem Seitenverhältnis der vollen
Auflösung. Bei Hochformat werden die Grenzen entsprechend gedreht. Gibt es keine
passende kleinere Auflösung, bleibt die native Auflösung aktiv; `quality_note`
im Kamerastatus erklärt diesen Rückfall. `CAMERA_WIDTH` und `CAMERA_HEIGHT`
bleiben die Ersatzwerte, falls die Formaterkennung fehlschlägt.

Fotos, Referenzbilder, Bildvergleiche, Graukalibrierung, Nachtaufnahmen und
`quality=high` fordern die volle Auflösung an. Anschließend kehrt die Kamera nach
der Ruhefrist zur kleinen Vorschau zurück, sofern noch Livebilder angefragt
werden. Ein geöffnetes Live-Zoomfenster oder die Option für hohe Qualität hält
die volle Auflösung entsprechend aktiv. Die Frist ist mit
`CAMERA_IDLE_SECONDS` konfigurierbar. Das Umschalten kann kurz dauern.

`requested_fps`, `reported_fps` und `fps_note` im Kamerastatus zeigen, ob der
Treiber die gewünschte Bildrate bestätigt. Die Bildverarbeitung wird zusätzlich
softwareseitig begrenzt; das garantiert bei einer abweichenden Treiber-Bildrate
keine entsprechend niedrigere USB-Datenrate. Das Endoskop behält seine feste
Auflösung, wird aber ebenfalls bei Nichtbenutzung geschlossen.

JPEGs werden je Kamerabild, Qualitätsstufe, Drehung, Ausschnitt und
Graukalibrierung gemeinsam aufbereitet und in einem begrenzten Cache gehalten.
Mehrere Zuschauer lösen dadurch für dasselbe Bild keine erneute JPEG-Kodierung
aus. HTTP-Antworten bleiben `no-store`, damit Browser keine alten Bilder zeigen.

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

## Mehrere Rahmen, Display-Ecken und PL81 PRO (v1.4.0)

Das Browser-Dashboard verwaltet bis zu acht Rahmen. Unter **Rahmen & Geräte**
für jeden Rahmen Name, Webcam und optional Relais/UART auswählen und **Zuordnung
speichern** drücken. Das zusätzliche Endoskop wird separat zugeordnet und erscheint
als Detailansicht mit eigener Fotoaufnahme. Die Dropdowns zeigen USB-Anschluss und
Gerätenamen; identische Kameras/CH340-Adapter sind durch ihre USB-Steckplätze getrennt.
Die USB-Steckplätze deshalb beibehalten. Abgezogene Geräte bleiben zugeordnet und
werden nicht durch einen beliebigen anderen Adapter ersetzt. Metadaten-Nodes einer
UVC-Kamera werden nicht als zweite Kamera angeboten.

**Display-Ecken bearbeiten** blendet vier nummerierte Griffe im Kamerabild ein:
oben links, oben rechts, unten rechts, unten links. Per Maus/Touch verschieben oder
mit den Pfeiltasten bewegen (Shift für größere Schritte), dann **Ausschnitt speichern**.
Die Vorschau und der Referenzvergleich entzerren das Viereck perspektivisch.
Gekreuzte, konkave und zu kleine Ausschnitte werden abgewiesen. Nach einer Änderung
an Kamera oder Ecken muss eine passende Referenz neu aufgenommen werden. Referenzen
und native Kameraeinstellungen gehören zum jeweiligen Rahmen bzw. USB-Gerät.
`rig.json`, `light.json` und Referenzen liegen im bestehenden persistenten Volume.
Versionskonflikte zwischen Browsern werden mit HTTP 409 abgewiesen.

Das NEEWER PL81 PRO wird **per USB-Datenkabel** gesteuert. Es nutzt wie LCUS-1
CH340 (`1a86:7523`), aber ein anderes Protokoll bei 115200 Baud. Deshalb ist eine
explizite, exklusive Portzuordnung nötig; keine automatische Auswahl anhand der
USB-Kennung allein. Helligkeit 1–100 %, Farbtemperatur 2900–7000 K (19 Hardwarestufen).
Aus bedeutet Helligkeit 0. Die API bestätigt Befehle erst nach passender Antwort
inklusive Prüfsumme. Fehlende Antworten bleiben als Fehler sichtbar.
Protokollquelle: https://github.com/m-rk/neewer-usb-control

Sichtbare Dashboard-Tabs senden alle fünf Sekunden ein Lebenszeichen. Ohne gültiges
Lebenszeichen läuft die Freigabe nach 15 Sekunden ab, der Hintergrunddienst sendet
anschließend Aus (normalerweise innerhalb weiterer zwei Sekunden). Verstecken,
Schließen und Abmelden geben die Freigabe zusätzlich sofort frei. Mehrere Tabs
sind unabhängig; ein noch sichtbarer Tab hält das Licht an. Das lokale Touch-Menü
sendet keine Lichtfreigabe. Helligkeit, Farbtemperatur und der manuelle Aus-Schalter
bleiben gespeichert; Browser-Freigaben überleben keinen Dienstneustart.
Beim Start, regulären Beenden und Wiederverbinden ohne aktive Freigabe wird Aus
angefordert. Bei Strom-/USB-Ausfall oder hartem Prozessabbruch kann die Software
keinen Befehl mehr übertragen; eine hardwareseitige Abschaltgarantie gibt es nicht.

Neue API (bestehende Anmeldung/Bearer-Token und CSRF-Regeln gelten unverändert):

| Methode | Pfad | Bedeutung |
|---|---|---|
| GET | `/api/devices` | Capture-Kameras und stabile USB-Serial-Pfade |
| GET/POST | `/api/rig` | Zuordnungen und Ecken; POST enthält die gelesene `revision` |
| GET | `/api/camera.jpg?frame_id=frame-1` | Kamera des Rahmens |
| GET | `/api/camera.jpg?frame_id=frame-1&cropped=true` | Entzerrter Displayausschnitt |
| GET | `/api/camera.jpg?detail=true` | Endoskopkamera |
| POST | `/api/photos?detail=true` | Endoskopfoto speichern |
| GET/POST | `/api/light` | Status bzw. `{mode, kelvin}`; `mode`: `auto`, `on`, `off`; Helligkeit immer 100 % |
| POST | `/api/ui/presence` | `{client_id, visible}`; individuelle ID je Tab |

Die bisherigen Kamera-, Foto-, Referenz-, Analyse-, Relais- und Serial-Endpunkte
akzeptieren zusätzlich `frame_id`. Für Automatisierungen immer explizit setzen.
Das Touch-Menü zeigt nach Zuordnung die Kamera/Relais/UART des ersten Rahmens.
Die vorhandene globale GPIO-Tasterverdrahtung wird nicht automatisch vervielfacht.

### Geek-szitman-Endoskop (v1.4.2)

Für die nicht-UVC-Geräte `0329:2022` und `2ce3:3828` verwendet die Anwendung einen
integrierten UseeePlus-Treiber über PyUSB/libusb. Ein zusätzliches Kernelmodul ist
nicht nötig. Der USB-Steckplatz wird als `supercamera:<USB-Pfad>` gespeichert.
Paketlängen und maximale Bildgröße werden geprüft; bei Abziehen wird erneut am
zugeordneten Anschluss gesucht. Die USB-Transfers haben begrenzte Timeouts.
Am 03.11.2026 wurden drei echte Bilder der angeschlossenen `0329:2022` mit
640 × 480 Pixeln erfolgreich dekodiert. Native V4L2-Kameraregler unterstützt dieses
Endoskop nicht. Protokollgrundlage (CC0):
https://github.com/hbens/geek-szitman-supercamera

Hardwarezuordnung am 03.11.2026: Rahmen 1 Kamera USB `1.5`, Relais `1.3.1`, UART
`1.3.2`; Rahmen 2 Kamera `1.2`, Relais `1.3.4.1`, UART `1.3.4.2`. Endoskop
`1.3.4.4`, NEEWER `1.3.4.3` (durch Antworten beim Drehen des physischen Reglers
eindeutig identifiziert). Die Zuordnung ist im Dashboard änderbar. Die erste
Webcam war mit Helligkeit/Gain am Maximum überbelichtet; Helligkeit 0, Gain 0
und Kontrast 34 wurden gesetzt und gespeichert. Ihre obere Displaykante liegt
aktuell außerhalb des Kamerabilds; für vollständige Kalibrierung Kamera ausrichten.
Die Rahmensteuerung wurde auf getrennte Anschlüsse konfiguriert, ohne Resetfolgen
auszulösen. Die räumliche Zuordnung von Webcam und Rahmenanschlüssen lässt sich
anhand des USB-Inventars allein nicht verifizieren.

## Live-Entzerrung und Fototests (v1.5.0)

Unter der Kamera kann **Live-Ansicht → Display · entzerrt** gewählt werden. Das
Hauptbild zeigt dann fortlaufend den perspektivisch korrigierten Ausschnitt des
aktiven Rahmens; **Originalkamera** schaltet zurück. Beim Bearbeiten der vier Ecken
wird automatisch das Originalbild eingeblendet. Der Zeitstempel zeigt erfolgreiche
Bildaktualisierungen. Die kleine Vorschau beim Bildvergleich aktualisiert sich
zusätzlich einmal pro Sekunde, solange sie im sichtbaren Bereich liegt.
**Foto aufnehmen** speichert die gewählte Ansicht. API:
`POST /api/photos?frame_id=frame-1&cropped=true`; Detailkamera und fehlende Rahmen-ID
werden in Kombination mit `cropped=true` abgewiesen.

Die Beleuchtung verwendet eingeschaltet immer **100 %**. Auch ältere Browser,
die noch einen kleineren Helligkeitswert senden, können die Leistung nicht mehr
reduzieren. Manuelles Aus und die vorhandene Browser-Abschaltung bleiben wirksam.
Als Standard sind **7000 K** eingestellt. Fototest vom 03.11.2026: 2900, 4000,
4950, 6000 und 7000 K bei konstanten 15,7 ms Belichtung, Gain 0, Helligkeit 0;
je drei Stichproben beider entzerrter Displaybereiche. 7000 K ergab auf beiden
Kameras den höchsten mittleren Grauwert (177,52 / 133,50 gegenüber 171,55 / 126,80
bei 2900 K). Dies ist eine relative Kamera-Messung, keine Lux-/Farbkalibrierung.
Die vorherige Belichtungsautomatik wurde zunächst wiederhergestellt. Beim
abschließenden Dauertest schwankte Kamera 1 damit jedoch stark (mittlere Grauwerte
72–171). Für Kamera 1 sind daher 15,7 ms manuelle Belichtung, Gain 0 und Helligkeit 0
dauerhaft gespeichert; Kamera 2 bleibt automatisch belichtet. Mit konstant aktivem
Browser-Heartbeat lagen die mittleren Differenzen aufeinanderfolgender entzerrter
Bilder danach bei 0,20 % / 0,19 % des Grauwertbereichs. Originale und entzerrte Fotos
wurden für beide Kameras gespeichert.

Zuordnungsversuch am neuen Rahmen: Eine einzelne viersekündige Unterbrechung an
Relais USB `1.3.4.1` entfernte genau den UART `1.3.4.2` mit Seriennummer
`9228766a2ca1ef118fa2926661ce3355`. Nach Einschalten kamen 26 neue UART-Zeilen.
In 40 Foto-Stichproben pro Kamera blieb der Anteil um mehr als 25 Grauwerte
veränderter Pixel bei 0 %. Der Rahmen lädt ohne neue Bildversion sein E-Paper
nicht neu. Daher ist die Relais-UART-Zuordnung bestätigt, die Kamera-Zuordnung
optisch **nicht bestätigt** und wurde nicht automatisch überschrieben.

## Full-HD-Vorschau und zusätzliche Kameraregler (v1.6.0)

Die Kameraaufnahme wählt die größte vom V4L2-Treiber gemeldete diskrete MJPEG-
Auflösung. Beide angeschlossenen UGREEN-Webcams melden maximal 1920 × 1080.
Die Standardvorschau wird auf maximal 1280 × 720 verkleinert (JPEG 88);
**Hohe Qualität · volle Auflösung** liefert die native Größe (JPEG 98).
Dies funktioniert auch für die entzerrte Ansicht. Fotos, auch Endoskop- und
Nachtfotos, werden mit JPEG 100 gespeichert, ohne Vorschau-Verkleinerung.
Bei entzerrten Fotos entspricht die Ausgabegröße dem Displayausschnitt aus dem
voll aufgelösten Kamerabild. MJPEG wird bereits in der Kamera komprimiert;
JPEG 100 vermeidet die zusätzliche bisherige starke Ausgabekompression, ist aber
kein RAW-Format. Die Antwort enthält `resolution` und `jpeg_quality`.
API: `GET /api/camera.jpg?frame_id=frame-1&quality=high`.
Die USB-Erfassung bleibt für sofortige Fotos in nativer Auflösung; der Schalter
ändert Auflösung und Kompression der Browserübertragung. Bestehende Ecken bleiben
gültig. Alte Referenzbilder in 720p müssen für Vergleiche neu aufgenommen werden.

Zusätzliche Regler werden nur angeboten, wenn die Kamera sie meldet: Schärfe,
Sättigung, Farbton, Gamma, automatischer/manueller Weißabgleich, Gegenlichtkorrektur,
Flimmerunterdrückung, Autofokus, manueller Fokus und Zoom. Einstellungen werden
weiterhin pro Kamera dauerhaft gespeichert. Die beiden angeschlossenen UGREENs
melden Weißabgleich 2800–6500 K, Schärfe 0–6 und 50/60-Hz-Flimmerunterdrückung,
aber **keine Fokus- oder Zoomregler**. Die Weboberfläche erklärt fehlende
Fokusunterstützung. Es werden keine erfundenen Fokuswerte an diese Kameras gesendet.
Abhängige manuelle Regler werden bei aktiver Automatik gesperrt; der Server
schaltet vor manuellen Schreibzugriffen die Automatik aus und stellt sie bei
Wiederherstellung korrekt zurück. Grundlage:
https://docs.kernel.org/userspace-api/media/v4l/ext-ctrls-camera.html

### Gespeicherte Kamera-Ausrichtung (v1.6.1)

Unter **Rahmen & Geräte → Kamera-Ausrichtung** stehen Querformat (0°), Hochformat
(90° rechts/links) und Querformat um 180° gedreht zur Auswahl. **Zuordnung speichern**
speichert die Auswahl im Rahmenprofil dauerhaft. Livebild, Originalfotos,
entzerrte Fotos, Nachtfotos und Referenzvergleich berücksichtigen die Drehung.
Beim Wechsel dreht der Server die eingereichten Display-Ecken aus der bisherigen
Ausrichtung mit; die beobachtete Displayfläche bleibt erhalten. API-Feld:
`frames[].rotation`, Werte 0/90/180/270. Bei einer kombinierten Änderung werden
`corners` noch in der bisherigen Ausrichtung angegeben. Referenzbilder sind an
Ausrichtung und Ecken gebunden und müssen nach deren Änderung neu aufgenommen werden.

Hardwareprüfung 03.11.2026: Beide Kameras gleichzeitig mit 1920 × 1080 aktiv;
Standardvorschau 1280 × 720, hohe Qualität und Originalfotos 1920 × 1080.
14 unterstützte Regler pro Kamera ausgelesen und aktive Werte erfolgreich
zurückgeschrieben. Browserprüfung: manueller Weißabgleich wird beim Ausschalten
der Automatik bedienbar; Fokus-Hinweis sichtbar. Rahmen 1 ist passend auf 270°
(Hochformat, 90° links) gespeichert, sein entzerrtes Foto hat 944 × 1203 Pixel.
Version 1.6.2 verwendet für die Standardvorschau im Hochformat 720 × 1280
und zeigt die Fotoauflösung entsprechend gedreht an. 54 automatisierte Tests bestanden.
Nach dem Dienstneustart bleibt die Hochformatwahl erhalten; Livebild 1080 × 1920,
Standardvorschau 720 × 1280 und gespeichertes Originalfoto 1080 × 1920 bestätigt.

### Dauerhafter Lichtmodus (v1.6.3)

Unter **Beleuchtung → Lichtmodus** stehen **Automatisch**, **Dauerhaft an** und
**Dauerhaft aus** zur Auswahl. **Licht speichern** sichert Modus und Farbtemperatur
in `light.json`. Dauerhaft an verwendet immer 100 % Helligkeit, auch ohne Browser,
nach Abmelden und nach Ablauf aller Browser-Freigaben. Dauerhaft aus bleibt auch
bei geöffnetem Dashboard aus. Nur Automatisch verwendet die bisherigen Freigaben.
Der gespeicherte Modus wird nach Dienst-/Pi-Neustart wieder angewendet. Beim
regulären Beenden wird das Licht zunächst ausgeschaltet, ohne den Modus zu ändern.
Alte Einstellungen und API-Anfragen mit `enabled: true/false` entsprechen
Automatisch/Dauerhaft aus. Andere offene Browser übernehmen gespeicherte Änderungen
beim nächsten Lebenszeichen, sofern sie keine ungespeicherten Lichtänderungen haben.

Verifikation am 03.11.2026: 57 Tests bestanden. Im Browser dauerhaftes Ein/Aus
gespeichert und nach Neuladen wiederhergestellt. Auf dem Pi Version 1.6.3 und
die drei Auswahlmöglichkeiten bestätigt. Das PL81 PRO bestätigte 100 % ohne
Browser nach Lease-Ablauf, 0 % trotz aktiver Freigabe sowie Automatik-Ein/Aus
mit passenden USB-Antworten. Anschließend bisherigen Modus Automatisch und
7000 K wiederhergestellt. Persistenz nach Neustart ist automatisiert getestet.

### 4K-JPEG-Fotos ohne zusätzliche Farbunterabtastung (v1.6.4)

Fotos bleiben ausschließlich JPEG mit Qualität 100 und der höchsten gemeldeten
MJPEG-Auflösung. Bei der erneuten JPEG-Kodierung wird jetzt 4:4:4 statt der
Standard-Farbunterabtastung 4:2:0 verwendet. Dadurch bleibt die volle Farbauflösung
des dekodierten Bildes erhalten, insbesondere bei feinen farbigen Kanten. Die
bereits in der Kamera entstandenen MJPEG-Verluste werden nicht rückgängig gemacht.
Die Standard-Livevorschau bleibt für die Übertragung verkleinert; sie begrenzt
weder Originalfotos noch die Vorschau mit hoher Qualität. Entzerrte Fotos bleiben
auf den gewählten Displayausschnitt begrenzt. Es wird kein PNG-Fotoformat ergänzt.

59 Tests bestanden, einschließlich 4K-Fotos unabhängig von der Vorschauqualität
und eines JPEG-Roundtrips mit abwechselnden roten/blauen Ein-Pixel-Linien.
Hardware am 04.11.2026: Eine UGREEN FineCam 4K CM973 an USB 1.5 liefert MJPEG
mit 3840 × 2160 (im gespeicherten Hochformat 2160 × 3840). Unkomprimiertes YUYV
wird nur bis 640 × 480 gemeldet und daher nicht verwendet. Die zweite Kamera
wird auf USB-Ebene nicht erkannt. Auch mit bestätigter Beleuchtung und testweise
100 ms Belichtung bleibt das Bild nahezu schwarz (mittlerer Grauwert ca. 11/255).
Belichtungsautomatik anschließend wiederhergestellt. Ein optischer Qualitätsvergleich
mit den alten Kameras ist erst bei freier Sicht auf das Motiv möglich.

Live-Verifikation von v1.6.4: Zwei gespeicherte JPEG-Fotos mit 2160 × 3840,
4:4:4-Abtastung für alle Komponenten und Qualität-100-Quantisierung heruntergeladen
und geprüft. Der alte, inkompatible Kamera-Reglersatz wurde auf dem Pi gesichert
(`camera-1699f5cf07815583.before-finecam-1793806731.json`) und durch die aktuellen
FineCam-Werte ersetzt. Nach dem Release-Neustart sind Autofokus und automatische
Belichtung aktiv; die Regler-API meldet keinen Fehler mehr.

### Große Liveansicht (v1.6.5)

**Groß anzeigen** neben „Foto aufnehmen“ öffnet das laufende Kamerabild über die
volle Browserfläche. Die Großansicht fordert automatisch die volle verfügbare
Auflösung an und zeigt den aktuellen Zeitstempel und die Bildmaße. Der ausgewählte
Original-/Displayausschnitt bleibt erhalten. Schließen über **Schließen · Esc**
oder die Escape-Taste; danach läuft die normale Vorschau mit ihrer bisherigen
Qualitätswahl weiter. Nur die sichtbare Hauptansicht wird aktualisiert. Native
Dialog-Fokusführung hält die Bedienung in der Großansicht und stellt den Fokus
beim Schließen wieder auf „Groß anzeigen“.

Browserprüfung mit laufendem Demo-Bild: Öffnen, aktuelle Bildmaße, bildfüllende
Darstellung ohne Verzerrung, Escape und Rückkehr zur normalen Vorschau geprüft.
Am Abend des 04.11.2026 liefert die FineCam wieder ein sichtbares, aber sehr dunkles
blaues Motiv. Der Treiber meldet im aktuellen Hochformatmodus höchstens 1440 × 2560;
durch die gespeicherte 270°-Drehung entstehen Fotos mit 2560 × 1440. Die zweite
Kamera fehlt weiter; die USB-Lichtsteuerung meldet E/A-Fehler. Ein belastbarer
optischer Vergleich mit den alten Kameras ist unter diesen Bedingungen nicht möglich.

Live-Deployment von v1.6.5 über API und sichtbare Großansicht bestätigt. Nach dem
Dienstneustart hängt die Kamera beim Öffnen; gezielte USB-Neuautorisierung des
Geräts a108:2240 an 1-1.5 läuft in einen Timeout. `authorized` ist anschließend
1, die Kamera bleibt also freigegeben. Zusätzlich treten USB-Fehler bei der
Beleuchtung und beim UART auf. Physisches Neuverbinden der Kamera angefragt.
Die Großansicht meldet den Bildausfall und versucht den Abruf weiter.

Nach vom Benutzer freigegebenem Pi-Neustart am 04.11.2026 gegen 20:27 Uhr
(Berlin) funktionieren Kamera, UART und USB-Lichtsteuerung wieder. Zwei frische
JPEGs mit 2560 × 1440, Qualität 100 und 4:4:4 geprüft. Unter bestätigter Beleuchtung
ist das Motiv hell und lesbar, ohne den vorherigen starken Blaustich. Native
Reglerwerte sind wieder plausibel, die Regler-API meldet keinen Fehler. Der
Kameramodus bleibt 1440 × 2560; die gespeicherte 270°-Drehung ergibt aktuell eine
seitliche Darstellung. Kameramodus und Ausrichtung wurden beim Neustart nicht
geändert.

## Weboberfläche v1.7.0

- Jede Rahmenkamera hat einen direkten Pfad `/cameras/<frame-id>` (z. B. `/cameras/frame-1` und `/cameras/frame-2`), die Endoskopkamera `/cameras/detail`. Die Startseite führt zur ersten Kamera.
- Die Navigation bleibt links; Livebild, Großansicht und JPEG-Foto stehen im Mittelpunkt. Kameraeinstellungen, Bildvergleich und Serial-Konsole sind aufklappbar. Gerätezuordnungen und Systemstatus liegen unter `/settings`.
- Anmeldung merkt sich auf Wunsch den Browser für 30 Tage. Nach der Anmeldung wird der angeforderte Kamerapfad wieder geöffnet. Abmelden widerruft die Sitzung dauerhaft.
- Fotos bleiben JPEG in nativer Auflösung mit Qualität 100 und 4:4:4; die Livebild-Vorschau kann weiterhin auf volle Auflösung umgeschaltet werden.

### Live-Prüfung v1.7.1 · 05.11.2026

- 62 Backend-Tests bestanden; vier Seiten zusätzlich mit DOM-Funktionstests geprüft. Kameraseite, Großansicht und Gerätezuordnung lokal in Chrome visuell geprüft.
- Live: `/cameras/frame-1`, `/cameras/frame-2`, `/cameras/detail`, `/settings`, Cookie-Sicherheit, wiederhergestellte Browser-Sitzung und Abmelden erfolgreich geprüft.
- Die gespeicherte Sitzung wurde vor einem echten Pi-Neustart angelegt und danach ohne erneute Anmeldung akzeptiert.
- Nach dem Dienstwechsel traten erneut USB-Timeouts an Kamera, CH340-Licht und CP210x-UART auf. Ein Pi-Neustart stellte Kamera 1 wieder her. Live-JPEG-Foto danach mit 2560 × 1440 erfolgreich. Diese USB-Instabilität bleibt ein Hardware-/Treiberbefund.
- Abschließender Live-Screenshot nicht möglich, da der Mac gesperrt war; Live-Prüfung erfolgte über HTTPS.

## Display-Kalibrierung v1.7.3

Unter „Display-Ausschnitt einstellen“ die Option „Display-Ecken bearbeiten“ aktivieren. Die vier runden Griffe sind durch eine blaue Kontur mit weißem Außenrand verbunden. Eine Ecke mit Maus, Touch oder Tastatur auswählen: Die Lupe zeigt den Bildbereich vierfach vergrößert mit Fadenkreuz. Ziehen erhält den ursprünglichen Greifabstand; ein bloßer Klick verändert den Ausschnitt nicht. Pfeiltasten verschieben um einen nativen Bildpixel, Shift + Pfeiltaste um zehn. „Ausschnitt speichern“ übernimmt die Positionen dauerhaft.

Während der Kalibrierung lädt das Livebild die volle Kameraauflösung für die Lupe. Die Lupe verwendet ausschließlich das bereits geladene Bild; sie erzeugt keine zusätzlichen Kameraaufrufe. Bei fehlendem Bild wird sie ausgeblendet.

Geprüft: drei gezielte DOM-Tests (`node --test tools/openpaper-testbench/tests/test_calibration.cjs`), 62 Backend-Tests, die vier Kameraseiten-/Settings-Flows und die Kalibrierung lokal und live im Browser. Live gemessen: 36 × 36 px pro Griff, sichtbare Kontur, 2560 × 1440 Pixel im Kalibrierungsbild. Die vorhandenen Gerätezuordnungen und gespeicherten Ecken wurden nicht verändert.

### Auswahl ohne springende Ecken · v1.7.4

Klick-/Tap-Zittern bleibt ohne Positionsänderung. Ziehen beginnt nach 5 CSS-Pixeln (Touch: 8); die Aktivierungsstrecke wird abgezogen, damit auch beim Überschreiten der Schwelle kein Sprung entsteht. Nur Bewegungsereignisse verändern die Position; abweichende oder gerundete Loslasskoordinaten werden ignoriert. Die Pfeiltasten bleiben pixelgenau.

Fünf gezielte Kalibrierungstests und die vier UI-Flows bestanden. Live: alle vier Ecken wiederholt ausgewählt und eine kleine Mausbewegung von 3 × 1 CSS-Pixeln geprüft; Polygonkoordinaten exakt gleich und Speichern weiter deaktiviert. Gespeicherte Ecken unverändert, Kamera online.


## Bildzoom für Livebilder und Fotos · v1.8.1

„Hover-Lupe“ zeigt die Stelle unter dem Mauszeiger vierfach vergrößert. Während die Lupe aktiv ist, lädt die Livevorschau die volle Kameraauflösung; ein zwischengespeichertes, dekodiertes Bild samt zuletzt gültigen Bildmaßen hält die Lupe auch beim nächsten Bildabruf sichtbar. Das berücksichtigt Browser, die während eines neuen JPEG-Abrufs vorübergehend Bildmaße von 0 melden. Dies gilt für die Originalkamera und die entzerrte Vorschau. Beim Bearbeiten der Display-Ecken bleibt die separate Kalibrierungslupe zuständig.

Ein Klick ins Livebild öffnet die angeklickte Stelle zweifach vergrößert. „Groß anzeigen“ öffnet das gesamte Bild. In der Ansicht zoomen Klick und Mausrad am gewählten Bildpunkt, Ziehen verschiebt den Ausschnitt, und zwei Finger erlauben Pinch-Zoom. Die Schaltflächen +/−, „Einpassen“ und „1:1“ stehen ebenfalls zur Verfügung; 1:1 entspricht einem Bildpixel pro CSS-Pixel. Bei fokussiertem Bildbereich funktionieren +/−, Pfeiltasten und 0. Esc schließt die Ansicht. Neue Livebilder behalten den Zoom und Ausschnitt bei.

„Letztes Foto ansehen“ und „Nachtfoto ansehen“ öffnen gespeicherte JPEGs im selben Werkzeug. Der Liveabruf pausiert dabei, sodass er das Foto nicht ersetzt. „JPEG herunterladen“ lädt das unveränderte Original. Kalibrierung und gespeicherte Ausschnitte werden durch Zoomen nicht geändert.

Prüfung: 6 gezielte Zoomtests und 5 bestehende Kalibrierungstests bestanden (`node --test tools/openpaper-testbench/tests/test_image_zoom.cjs tools/openpaper-testbench/tests/test_calibration.cjs`), ebenso 62 Backend-Tests. Vier UI-Flows prüfen Kamera-/Seitenauswahl, Fotoansicht und Wiederaufnahme des Livebilds. Hover-Lupe, Klick-Zoom, Verschieben, Mausrad und JPEG-Fotoansicht zusätzlich lokal im Browser geprüft.

Live bestätigt: v1.8.1, Kamera verbunden, Original-JPEG und Zoom-Livebild mit 2560 × 1440 Pixeln. Hover-Lupe bleibt während neuer JPEG-Abrufe sichtbar, Klick öffnet die gewählte Stelle. Alle ausgelieferten Zoom-Dateien stimmen mit dem geprüften Quellstand überein; Geräte- und Ausschnittkonfiguration unverändert.

## Kamerawechsel auf dem Pi-Display · v1.8.3

Unter Webcam oben die Kamera auswählen. Angeboten werden die konfigurierten Rahmen sowie ein zugeordnetes Endoskop. Die Auswahl wird lokal gespeichert. Livebild und Foto verwenden dieselbe Kamera; Referenz und Vergleich gehören zum gewählten Rahmen. Beim Endoskop ist der Rahmenvergleich deaktiviert. Die Steuerungsseite behält ihre bisherige Zuordnung. Kiosk-Label auf 1.8.3 erhöht, damit das Display das Update lädt.

Geprüft: DOM-Funktionstest für Umschalten, Foto-Zuordnung, Endoskop und Speichern der Auswahl; 62 Backend-Tests bestanden. Release und ausgelieferte Dateien live überprüft, Kamera verbunden.

### Graufläche: Weißabgleich und Helligkeit

Auf der Kameraseite unter **Weißabgleich & Helligkeit kalibrieren** eine neutrale,
 gleichmäßig beleuchtete Graufläche ins Bild legen, **Graufläche auswählen** und
 ein Rechteck darüber ziehen. Alternativ lassen sich Position und Größe in Prozent
 eingeben. Die Auswahl verwendet die gedrehte Originalansicht, nicht den entzerrten
 Displayausschnitt. **Zielhelligkeit (RGB)** bestimmt den neutralen Grauwert;
 Vorgabe 118 entspricht ungefähr 18 % Grau in sRGB. **Kalibrieren** speichert die
 Korrektur, **Zurücksetzen** entfernt sie.

Die Softwarekorrektur gleicht die gemittelten linearen sRGB-Kanäle der Messfläche
 an den Zielwert an und gilt für Livebild, Stream, neue Fotos, Nachtfotos und
 Bildvergleiche. Jede Messung verwendet unveränderte Kamerapixel, auch bei bereits
 aktiver Kalibrierung. Einstellungen liegen je Kamera neben deren nativen Reglern
 in `*.gray.json` und überstehen Neustarts. Bereits gespeicherte Fotos bleiben
 unverändert. Vergleichsreferenzen der Kamera werden bei Kalibrierung oder Reset
 verworfen und müssen neu aufgenommen werden.

Die Messfläche muss mindestens 8 × 8 native Pixel umfassen. Zu dunkle Flächen,
 mehr als 2 % geclippte Pixel (mindestens ein Kanal ≥ 250) und Verstärkungen über
 Faktor 16 werden abgelehnt; die bisherige Kalibrierung bleibt erhalten. Die Fläche
 muss tatsächlich neutral sein; die Software kann das nicht aus dem Bild erkennen.
 Helle Bildbereiche können durch die Korrektur clippen. Native Kameraeinstellungen
 werden nicht geändert. Für konstante Ergebnisse automatische Belichtung und
 automatischen Weißabgleich ausschalten und nach Licht-/Kameraänderungen neu
 kalibrieren. Während einer Nachtaufnahme sind Änderungen gesperrt.

| Methode | Pfad | Inhalt |
| --- | --- | --- |
| GET | `/api/camera/gray-calibration?frame_id=frame-1` | Aktive Korrektur und Messwerte |
| POST | `/api/camera/gray-calibration?frame_id=frame-1` | `{"region":{"x":0.4,"y":0.4,"width":0.2,"height":0.2},"target":118}` |
| POST | `/api/camera/gray-calibration/reset?frame_id=frame-1` | `{}` |

`target`: 32–224; Koordinaten normiert auf 0–1. Gleiche Authentifizierung und
 CSRF-Prüfung wie für die übrige Kamera-API.

### Unvollständige USB-Kameraregler erkennen (06.11.2026)

`v4l2-ctl --list-ctrls-menus` kann trotz erfolgreichem Prozessende einzelne
UVC-Lesefehler (`error 32 getting ctrl` / `getting ext_ctrl`) und Werte außerhalb
der Treibergrenzen liefern, etwa Belichtung 0 bei Minimum 1. Die API weist solche
Antworten nun mit HTTP 503 zurück. Sie werden weder als aktuelle Einstellungen
angezeigt noch als Ausgangswerte gespeichert. Ungültige Hersteller-Defaults bleiben
zulässig, sofern die tatsächlich gelesenen Werte gültig sind.

Hardwarebeobachtung: Kamera 2 bestätigte 8,7, 15,5 und 30 ms, ohne eine messbare
Helligkeitsänderung zu liefern. Später meldete der Kernel eine zu kurze UVC-Antwort
und USB-Fehler. Nach Neustart des Pi funktionieren Kamera 1 und Licht wieder;
Kamera 2 scheitert weiterhin bei der USB-Anmeldung. Ein vom externen Hub
bestätigtes gemeinsames Aus-/Einschalten seiner Ports brachte Kamera 2 nicht
zurück. Danach blockierte erneut die Kamerainitialisierung; der Pi wurde zur
Wiederherstellung nochmals neu gestartet. Weitere USB-Resetversuche wurden beendet. Die gemeldeten Power-Bits beweisen keine tatsächliche Unterbrechung der
5-V-Versorgung. Kamera-Firmware, Kabel und Hub sind damit nicht eindeutig getrennt.

Die Fehlerprüfung ist als gezielter Hotfix im laufenden Testbench-Container
installiert (Original gesichert unter `/data/camera_controls.before-uvc-guard-20261106.py`).
Sie ist auch im Quellcode enthalten, aber noch nicht als neues Balena-Release
gebaut. Bei einer Container-Neuerstellung aus dem bisherigen Image geht der
Hotfix verloren. Prüfung: 76 Backend-Tests bestanden.

Abschlussprüfung nach dem letzten Neustart: Kamera 1 meldet ein frisches Bild
(Alter 0,07 s), JPEG-Endpunkt HTTP 200; Licht bestätigt den gespeicherten
Automatikmodus. Kamera 2 bleibt ohne Kameragerät/Bild. Gerätezuordnung weiterhin
Revision 15. Kamera 2 benötigt als nächsten Test eine physische USB-Trennung
und gegebenenfalls ein anderes Kabel bzw. einen direkten Pi-Anschluss.

Nachtrag 06.11.2026, 13:45 Uhr (Berlin): Kamera 2 wurde mit demselben Kabel direkt
am Pi angeschlossen. Der Kernel erkennt sie nun an `1-1.4`, erhält aber weiterhin
eine unvollständige Konfigurationsbeschreibung (9 statt 645 Bytes) und meldet
`can't set config #1, error -110`; ein V4L-Kameragerät entsteht nicht. Die
Rahmenzuordnung wurde deshalb noch nicht geändert. Ein anschließender Neustart
um 13:40 Uhr hat den Pi bis zum Prüfzeitpunkt weder über Balena noch über seine
bisherige LAN-Adresse wieder erreichbar gemacht. Angefordert ist ein physischer
Neustart ohne Kamera 2. Ob Kabel, Kamera oder der gemeinsame USB-Controller die
Ursache sind, ist weiterhin offen; der Fehler trat am direkten Anschluss bereits
vor diesem Neustart auf, während der Controller schon USB-Fehler meldete.

## Zuordnung und Anmeldung · v1.8.5

Beim Wechsel des aktiven Rahmens speichert die Einstellungsseite offene Änderungen
an Name, Geräten, Ausrichtung und Ecken zuerst. Schlägt das Speichern fehl, bleibt
sie beim bisherigen Rahmen und erhält die Eingaben. „Geräte neu suchen“ aktualisiert
nur das USB-Inventar, ohne die Eingaben durch die gespeicherte Konfiguration zu
ersetzen. Abgezogene Geräte bleiben als „Nicht verbunden“ ausgewählt. Beim
Verlassen mit offenen Änderungen warnt der Browser; „Ausschnitt speichern“ lässt
ungespeicherte Geräteänderungen bestehen.

Die Kameraidentität bleibt an den gespeicherten USB-Pfad gebunden. Kameras und
Hub an denselben Steckplätzen betreiben und Kabel/Ports beschriften. Ein Umstecken
an einen anderen Port erfordert weiterhin eine bewusste neue Zuordnung; identische
Webcams werden nicht anhand ihres Modellnamens automatisch vertauscht.

Am 08.11.2026 wurden die Namen auf dem laufenden Teststand aus den jeweiligen
UART-Zeilen `[MAIN] UID:` übernommen und dauerhaft gespeichert:

- `frame-1`: `epd7-58e6c5eb0a48`
- `frame-2`: `epd13-58e6c5d3e170`

Navigation, Seitentitel und Kameraauswahl auf dem Touchdisplay verwenden diese
Profilnamen bereits. Gerätepfade, Ausrichtung und Kalibrierung blieben unverändert.

Gemerkte Sitzungen werden beim Start auch dann geladen, wenn die Uhr des Pi noch
zurückliegt und das Ablaufdatum dadurch mehr als 30 Tage in der Zukunft erscheint.
Die ursprüngliche Ablaufzeit wird nicht verlängert; Abmelden und Passwortänderung
widerrufen die Sitzung weiterhin. Das Cookie verwendet `SameSite=Lax`, damit ein
normaler Link von einer anderen Website die Sitzung mitsendet; `HttpOnly`, HTTPS-
`Secure`, Origin- und CSRF-Prüfung bleiben bestehen. Siehe
[MDN: SameSite-Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value).
Die Login-Seite prüft `/api/session` und führt bei einer gültigen Sitzung direkt
zum ursprünglichen Ziel zurück. Das hilft auch bei bereits gesetzten Strict-Cookies
und einem Lesezeichen auf der Login-Seite. LAN- und öffentliche URL haben weiterhin
getrennte Browser-Cookies; für regelmäßige Nutzung dieselbe Adresse verwenden.

Prüfung: Backend- und DOM-Regressionstests für Start vor Uhrsynchronisierung,
Sitzungsablauf und Widerruf, Geräteverlust, Neusuche, Rahmenwechsel,
Speicherfehler und gleichzeitige Zuordnungs-/Kalibrierungsänderungen. Im lokalen
Chromium zusätzlich persistentes HttpOnly/Lax-Cookie, automatische Rückkehr von
der Login-Seite und Einstieg über einen externen Link ohne Neuanmeldung geprüft.
Nach erneuter Balena-Anmeldung als Release `33bada0fa00823ee237c193593c8343c`
(4487047) veröffentlicht. Balena meldet das Gerät mit dieser Version als
`operational`; die Live-API bestätigt Version 1.8.5.

Live-Abschlussprüfung am 08.11.2026: 79 Backend-Tests und 18 UI-Tests bestanden.
Eine vor dem Deployment angelegte 30-Tage-Sitzung wurde nach dem Austausch des
Containers ohne Neuanmeldung akzeptiert. Die ausgelieferten Dateien `rig.js`,
`login.js` und `index.html` stimmen bytegenau mit dem geprüften Quellstand überein.
Neue Login-Cookies bestätigen 30 Tage, HttpOnly, Secure und SameSite=Lax; die beiden
nur zur Prüfung angelegten Sitzungen wurden anschließend widerrufen.

Nach dem Dienstwechsel meldete der Kernel erneut USB-Fehler (-32/-71/-110) an
Kameras, UARTs und Licht. Ein geordneter Pi-Neustart stellte beide Kameras wieder
her: frische JPEGs mit 3840 × 2160 bzw. 1440 × 2560 Sensorpixeln erfolgreich
abgerufen. Die Lichtsteuerung bestätigt den gespeicherten Modus `on`. Profilnamen,
Gerätepfade, Ausrichtung, Ecken und Revision 19 blieben auch nach dem vollständigen
Pi-Neustart exakt erhalten. Die beobachtete USB-Instabilität wird durch diese
Änderung nicht als behoben betrachtet.
