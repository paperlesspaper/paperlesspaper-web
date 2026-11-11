## Google-Anmeldung und Google-Kalender-Integration

### Anmeldung mit Google

Sie können sich bei paperlesspaper mit Ihrem Google-Konto anmelden, sofern Sie diese Anmeldeoption wählen. Für die Kontoanmeldung verwenden wir unseren Authentifizierungsdienst Auth0. Dabei werden die von Google freigegebenen grundlegenden Kontodaten verarbeitet: eine eindeutige Konto-Kennung, Ihre E-Mail-Adresse und deren Bestätigungsstatus sowie, soweit bereitgestellt, Ihr Name und Profilbild. Diese Daten dienen dazu, Sie zu authentifizieren, Ihr paperlesspaper-Konto zuzuordnen und Ihr Profil anzuzeigen. Ihr Google-Passwort wird nicht an paperlesspaper übermittelt. Die Kontoanmeldung allein gewährt keinen Zugriff auf Ihre Google-Kalender.

### Optionaler Zugriff auf Google Kalender

Wenn Sie die Google-Kalender-Integration aktivieren, werden Sie gesondert zu Google weitergeleitet und entscheiden dort über die angeforderten Berechtigungen. paperlesspaper fordert einen lesenden Kalenderzugriff (https://www.googleapis.com/auth/calendar.readonly) sowie grundlegende Profilinformationen an. Wir lesen Ihre Kalenderliste mit Kalenderkennungen, Namen und zugehörigen Einstellungen, damit Sie Kalender auswählen können. Für die ausgewählten Kalender rufen wir Termine im konfigurierten Zeitraum ab. Dazu können Titel, Beginn und Ende, Zeitzone, Beschreibung, Ort und weitere von der Kalender-API mitgelieferte Termininformationen gehören.

Wir verwenden diese Daten, um die von Ihnen gewählte Kalenderübersicht in der App vorzubereiten, als Bild zu erzeugen und auf dem von Ihnen zugeordneten E-Paper-Display anzuzeigen und zu aktualisieren. Die Integration erstellt, verändert oder löscht keine Termine oder Kalender in Ihrem Google-Konto.

### Speicherung, Hintergrundaktualisierung und Empfänger

Wir speichern die Zuordnung zu Ihrer Kalenderanzeige, Ihre Kalenderauswahl und Einstellungen sowie die von Google bereitgestellten Zugriffstokens und gegebenenfalls Aktualisierungstokens (Refresh Tokens) auf unseren Systemen. Damit kann die Anzeige auch aktualisiert werden, wenn Sie die App gerade nicht geöffnet haben. Abgerufene Kalenderdaten werden für Vorschau und Bilderstellung verarbeitet; erzeugte Anzeigebilder werden zur Bereitstellung an Ihr Gerät gespeichert. Kalenderinhalte können für Personen sichtbar sein, die Zugriff auf Ihre freigegebene paperlesspaper-Organisation oder Ihr Display haben.

Die Verarbeitung erfolgt durch paperlesspaper und die für Authentifizierung, Hosting, Speicherung und technische Bereitstellung eingesetzten Dienstleister, soweit dies für die jeweilige Funktion erforderlich ist. Bei der Verbindung mit Google werden technisch erforderliche Verbindungsdaten und Autorisierungsinformationen an Google übermittelt. Für Googles eigene Verarbeitung gilt die Google-Datenschutzerklärung: https://policies.google.com/privacy?hl=de. Dabei kann eine Verarbeitung außerhalb der EU bzw. des EWR stattfinden.

### Zweckbindung und Limited Use

Die über Google erhaltenen Konto- und Kalenderdaten werden für die von Ihnen genutzten Anmelde- und Kalenderfunktionen verwendet. Sie werden nicht verkauft, nicht für personalisierte Werbung genutzt und nicht zum Training allgemeiner KI- oder Machine-Learning-Modelle verwendet. Die Verwendung und Weitergabe der über Google APIs erhaltenen Informationen durch paperlesspaper richtet sich nach der Google API Services User Data Policy, einschließlich der Anforderungen zur eingeschränkten Nutzung (Limited Use): https://developers.google.com/terms/api-services-user-data-policy.

### Rechtsgrundlagen, Widerruf und Löschung

Die Verarbeitung zur Bereitstellung Ihres Nutzerkontos erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO. Die optionale Freigabe Ihres Google-Kontos und des Kalenderzugriffs erfolgt auf Grundlage Ihrer Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Sie können diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, insbesondere indem Sie paperlesspaper den Zugriff in Ihrem Google-Konto unter https://myaccount.google.com/connections entziehen. Anschließend sind weitere Kalenderabrufe mit dieser Berechtigung nicht mehr möglich. Die Rechtmäßigkeit der bisherigen Verarbeitung bleibt unberührt.

Die gespeicherten Kontodaten, Integrationseinstellungen und Tokens werden nur so lange aufbewahrt, wie sie für die jeweiligen Funktionen erforderlich sind. Zur Löschung der bei uns gespeicherten Google-Konto- und Kalenderdaten können Sie sich an robert@wirewire.de wenden. Nach Wegfall des Zwecks oder einem berechtigten Löschersuchen werden die betreffenden Daten gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Der Entzug der Google-Berechtigung löscht bereits erzeugte Anzeigebilder nicht automatisch. Ein E-Paper-Display kann das zuletzt übertragene Bild auch ohne Verbindung weiter anzeigen; ersetzen Sie diese Anzeige bei Bedarf durch einen anderen Inhalt.

---

Begleitende Änderung im bestehenden Abschnitt „Authentifizierung“:

Für die Anmeldung am paperlesspaper-Nutzerkonto verwenden wir Auth0. Der Dienst verwaltet Benutzerkonten und Anmeldesitzungen. Bei einer Anmeldung mit E-Mail-Adresse und Passwort wird das Passwort durch Auth0 verarbeitet und nicht an unsere Anwendung übermittelt. Wenn Sie „Mit Google anmelden“ wählen, erfolgt die Prüfung Ihres Google-Passworts bei Google; paperlesspaper erhält die freigegebenen Kontoinformationen. Die gesonderte Verbindung zu Google Kalender erfolgt direkt über Googles Autorisierungsverfahren. Einzelheiten zu Google-Anmeldung und Kalenderzugriff finden Sie in Abschnitt 9.

CMS-Datensatz: https://backend.paperlesspaper.de/admin/collections/pages/67313bde0c6dd2734e2bc9d9

Der neue Abschnitt wurde als Markdown-Block 09 unter deutscher Sprache eingetragen. Die vorherigen acht Blöcke bleiben bestehen. Der Authentifizierungsabsatz in Block 04 wurde präzisiert; die 17 Überschriften und die außerhalb dieses Absatzes bestehenden Links wurden im Editor auf Erhalt geprüft. Veröffentlichung wurde ausgelöst, aber der Erfolg war beim letzten Zugriff noch nicht bestätigt. Öffentliche Kontrolle zeigte zunächst noch die alte Fassung.

Abschluss: Im CMS am 19.09.2026 als Published bestätigt (Last Modified 10:05 AM). Website-Cache über Dashboard erneuert; anschließend beide Änderungen öffentlich auf https://paperlesspaper.de/posts/privacy verifiziert: präzisierter Auth0-Absatz und vollständiger Abschnitt 9 einschließlich Google-Datenarten, Kalenderzugriff, Tokens, Anzeigebilder, Limited Use, Widerruf und Löschung. Links zu Google-Datenschutz, User Data Policy, Google-Verbindungen und Kontakt sind vorhanden. Aktualisiert wurde die deutsche Sprachfassung.
