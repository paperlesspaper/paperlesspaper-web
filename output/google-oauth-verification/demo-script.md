# paperlesspaper — Google Calendar OAuth verification demo

Prepared 2026-09-19. This is a recording script, not a completed demo video.

## Verified application facts

- Google Cloud project: `wirewire` (`719541140462`).
- Brand: paperlesspaper, verified.
- Audience: External, In production.
- Calendar permission saved for verification: `https://www.googleapis.com/auth/calendar.readonly`.
- The source change makes the web login use the same read-only scopes as the native login and disables inclusion of previously granted broader scopes. The fix was merged in PR #157 (merge commit 0e0086d99e7023181ab046c3504facf48c3e296e); Dokploy deployment completed successfully (6m 21s); the live bundle index-DnVz6-ca.js contains the narrowed scope and include_granted_scopes=false.
- The frontend now displays Calendar OAuth errors returned in otherwise successful HTTP responses. TypeScript validation passes.
- Backend API operations: `calendar.calendarList.list()` and `calendar.events.list()`.
- OAuth user count shown by Google Cloud: 100 / 100.
- Google Cloud blocks submission until a demo-video link is supplied.

## Recording setup

Use the real application and real Google consent flow with the corrected read-only scope. Set the consent screen language to English. Use a demo calendar with innocuous sample events, such as "Design review" and "Project planning". Do not include unrelated calendars, personal appointments, credentials, or cloud secrets in the video. Demonstrate each active OAuth consent workflow; do not represent a browser device emulation as a native iOS or Android recording.

## Scenes and English captions

1. **Application identity.** Show the public paperlesspaper homepage, then the application's Google Calendar integration.
   Caption: "paperlesspaper displays selected calendar events as an agenda on an e-paper display."
2. **User-initiated connection.** Show the user opening the Google Calendar integration and clicking Sign in with Google.
   Caption: "Google Calendar access is requested when the user enables this integration."
3. **Google authorization.** Show account selection, the unverified-app notice, and the complete Google consent screen in English. Expand permission details so the requested read-only access is visible. Keep the browser address bar visible where practical.
   Caption: "The application requests read-only access to Google Calendar. It does not need permission to create, edit, or delete calendars or events."
4. **Calendar selection.** Return to paperlesspaper and show the available calendars. Select only the demo calendar.
   Caption: "The calendar list allows the user to choose which calendars appear on their display."
5. **Visible data use.** Show the real agenda preview containing the demo events and the relevant layout controls.
   Caption: "Upcoming events from the selected calendar are read and rendered as an agenda."
6. **Other active clients.** Record the equivalent real native authorization and display flow on iOS and Android if those clients are included in the verification request. Identify each platform with an English title card.

## Saved scope justification

paperlesspaper displays a user's selected Google Calendar events as an agenda on their e-paper display. After the user connects Google Calendar, the app calls calendarList.list so the user can choose calendars, and events.list to read upcoming events from those selected calendars and render the agenda. The integration only reads calendar data; it does not create, edit or delete calendars or events. calendar.readonly covers the calendar list and event reads required for this feature. Basic profile scopes cannot access calendars, and free/busy access does not provide the event titles and details needed for the agenda. Access is requested when the user enables the Google Calendar integration.

## Delivery

Review the recording for readable permissions, actual calendar output, and absence of unrelated private data. Upload the finished video as unlisted, supply its accessible URL in Google Cloud Data Access, and submit from the Verification Center. Verify the submitted status. Approval remains a Google review step; saving scopes alone does not remove the warning.

## References

- [Google demo-video requirements](https://support.google.com/cloud/answer/13804565?hl=en)
- [Verification Center](https://console.cloud.google.com/auth/verification?project=wirewire)

## Current status (2026-09-19, 07:50 Berlin)

No usable demo video has been uploaded, and no verification request has been submitted.

- PR https://github.com/paperlesspaper/paperlesspaper-web/pull/157 is merged. Live hosting is Dokploy at https://tools.paperlesspaper.de (project paperlesspaper, production, web). Autodeploy completed merge commit 0e0086d99e7023181ab046c3504facf48c3e296e (6m 21s). The live entrypoint index-DnVz6-ca.js was checked for the narrowed scope and include_granted_scopes=false.
- TypeScript and diff checks passed. CI: 59 passed, 8 skipped, 2 existing device-settings success-message failures identical to the pre-change run 35325939287. Current run 35424031038.
- A live production OAuth reauthorization successfully loaded the calendar list. Local-origin authorization against the production API fails with redirect_uri_mismatch and is unsuitable for the demonstration.
- Calendar “paperlesspaper Demo” in the existing test account has three neutral events from demo-events.ics (3/3 imported). Select only this calendar when filming.
- A native macOS screen-recording test saved a MOV but captured the wrong foreground window. The unusable recording and its inspection image were deleted; neither was uploaded. A user-assisted start of a recording of the Chrome window was requested; no reply received yet.
- Existing test account has historical Calendar write permission. No grants have been revoked. A narrower token with include_granted_scopes=false must be checked after deployment. The post-deployment Google consent dialog was checked: it lists exactly four permissions (calendar read-only, profile, email, identity), and reauthorization succeeds. Revocation is not needed.
- No iOS simulator or Android device is available for authentic native footage.
- Do not present browser device emulation as native footage.

References: [Popup redirect origin and code exchange](https://developers.google.com/identity/oauth2/web/guides/use-code-model), [Exclude historical granted scopes](https://developers.google.com/identity/oauth2/web/reference/js-reference).

## Follow-up API correction and remaining verification

- The live test exposed replay of the stored, already-consumed OAuth code on subsequent preview requests. PR https://github.com/paperlesspaper/paperlesspaper-web/pull/158 fixes this and stops persisting single-use codes on create/update. Merged as 65cb9c4cc873ac5a8793b4baccc8bebe2b7b862a.
- Eight focused API Calendar tests pass. Three new controller regressions fail against the pre-change controller, confirming the reproduction. GitHub E2E run 35425243518 is still running at 08:03 Berlin.
- Dokploy emailed successful builds for web at 07:58:55 and API at 07:59:26 Berlin on September 19. API email: https://mail.google.com/mail/u/?authuser=robert%40wirewire.de#all/1a0b83f951febe15 .
- In the live form, all eight unrelated calendars were deselected; only paperlesspaper Demo remains selected. Display language is English. The Google consent screen uses four requested permissions with no calendar write access.
- The preview still showed “No events to show” before the API correction could be checked live. Confirm that the preview now receives the three imported events and renders them. If the API returns events but the iframe stays empty, inspect stale INIT payload handling: PhotoFrame.tsx memoizes previewInitData on watchAll.meta identity while IntegrationPreview sends GOOGLECALENDAR followed by INIT. This is a hypothesis, not a confirmed cause.
- The UI is currently at the Send-to dialog for the offline test frame; Send was NOT pressed. The form selection and refreshed tokens are not confirmed saved. Do not send to additional frames.
- Native Chrome access now returns only the window title and no screenshot, so the post-deployment UI test and recording cannot continue until the Mac UI is accessible. A user request to bring Chrome forward and start recording remains unanswered. No usable video exists and nothing has been submitted to Google.
- Before a final video is uploaded, verify no private calendars/events, tokens, unrelated tabs, or other apps are visible; remove audio from raw footage. The failed recording of another foreground window was deleted.

## Refresh-token durability follow-up (2026-09-19)

- User asked about indefinite updates and backwards compatibility. Inspection found that generateAuthToken returned refresh_token: undefined when Google omitted it on refresh; preview/update persistence could therefore erase a valid legacy refresh token.
- PR https://github.com/paperlesspaper/paperlesspaper-web/pull/159 is merged as de7f52bdf22172ed8f33b637eec7257312a46c6d (08:06:35 Berlin). The function now preserves the refresh token supplied for the refresh grant, unless Google returns a replacement. Fresh code grants never borrow an old account token.
- Eleven focused Calendar tests pass. The new repeated-expiry/save-cycle test fails against the previous implementation. Rotated-token adoption and account separation are tested too. This is simulated renewal coverage, not a months-long live test.
- Existing valid refresh tokens and OAuth clients remain supported; none were revoked. Connections already missing a refresh token or revoked by Google still require reauthorization. Google does not guarantee permanent grants.
- The separate preview/demo/verification work remains blocked on Mac UI access as described above.

## Verified continuation — 2026-09-19 08:23 Berlin

- Live calendar-preview response returned HTTP 200 with the real imported demo events; calendarAuth was empty (no error). This isolated the remaining failure to iframe message ordering.
- PR 160 https://github.com/paperlesspaper/paperlesspaper-web/pull/160 merged as caf090cf77267da157241eeede4c606b40fb1d10. INIT now precedes GOOGLECALENDAR. Receiver regression covers initial iframe load, updates and reloads; fails on previous code, passes on fix. TypeScript passed.
- Dokploy web deployment success at 06:18:32 UTC, API at 06:18:37 UTC.
- Saved test paper 6aae1a2006a28bd3f99d59c2 with only paperlesspaper Demo selected, English, range 3, limit 50. Senden clicked for offline device 651dd070603aae42a6379251. Save completed.
- Confirmed rendered image AND live iframe show Design review, Project planning, Prototype check after page reload. Imported Google events have UTC timezone, so shown times are 08:00, 12:00 and 09:00 UTC.
- Device now assigned test paper. Restore original 6a9df7173495dc6ace5395bd after demo, checking assignment still belongs to test paper first.
- Google submit form still explicitly reports missing demo video, Confirm disabled. Additional explanatory text entered (unsaved; no submission yet).
- No completed demo video, no YouTube upload, no Google submission. Existing 07:47:23 MOV is a 6.65-second homepage-only fragment; not a complete verification demo. Do not submit it as complete.
- macOS recording UI is unreliable: apparent start/stop did not produce a new file. User asked asynchronously to start recording with Shift-Cmd-5, keep Chrome foreground, and reply 'Aufnahme läuft'. Await that concrete step before filming the consent workflow. Do not claim recording is running without checking.
- PR 158 full CI has 4 failures (device-settings both projects plus organization cases); focused calendar tests pass. Earlier baseline had 2 device-settings failures, so do not claim all four were proven baseline. PR159 CI still pending when last checked.

## User-confirmed recording attempt — 08:26–08:28 Berlin

User said 'Aufnahme läuft'. Performed homepage, public privacy page, Konto wechseln, existing utzel account, OAuth warning, English resume and consent, expanded '4 services' and Calendar read permission details, Continue, selected-only demo calendar list, final three-event preview. Issued Cmd-Ctrl-Escape after final view.

No new MOV found yet. A new PNG exists at 08:26:04. Old MOV 08:19:18 covers previous turn only and includes an unrelated foreground dialog; not usable as a complete OAuth demonstration. Asked user where current recording is saved / to stop it if still running. No upload or submission. Prepared youtube-description.txt for when actual video is available.

## Final supplied video accepted — 2026-09-19

- User provided /Users/utzel/Desktop/Bildschirmaufnahme 2026-09-19 um 09.23.53.mov (83.88 sec, 3456x2234).
- Visually reviewed contact sheets including English OAuth consent and expanded four permissions around 48–67s, followed by successful Calendar display and demo-only final preview.
- User explicitly approved leaving the other calendar appointments in the video. Use this latest original video as accepted; do not request that approval again.
- Original objective still requires unlisted upload and verification submission. Neither done.
- Opened youtube.com/upload in new Chrome tab; title reached YouTube Studio. CUA native then returned stale menu-only accessibility contents, screenshots unavailable, Chrome extension browser absent (only iab). Reset did not recover. Asked user to foreground YouTube Studio, close dialogs/menus, keep Mac unlocked and reply bereit.

## Upload in progress — 2026-09-19

User explicitly accepted YouTube terms at action time ('ja, mach weiter'). Uploaded the approved original 09.23.53 MOV to Robert Gühne channel UCgfHk9WJivPkN7-Fmu2PdvA. Title: paperlesspaper — Google Calendar OAuth verification demo. Audience: not made for kids. Visibility selected and saved: Unlisted (Nicht gelistet).
Video URL: https://youtu.be/cW6HNr2X_-Q
Upload completed; YouTube processing pending at time of this note.
Google Data Access YouTube URL saved and verified in submission summary. Additional information explicitly states video covers web only, not separate Android/iOS recordings. Final submission not clicked yet, pending playable video.

## Upload complete; final Google submission still pending

- Uploaded original approved video and saved Unlisted. YouTube upload complete, SD/HD processing complete, copyright checks: no issues; 4K still processing at last Studio observation.
- Independently opened https://www.youtube.com/watch?v=cW6HNr2X_-Q in in-app browser without signed-in account: actual player loaded, duration 1:23, confirming link access.
- Cloud YouTube URL persisted; final submit summary showed no missing-video error and enabled Bestätigen.
- Additional information entered in original Cloud tab, explicitly describing web-only demo and missing separate Android/iOS recordings.
- Final Bestätigen NOT clicked. Native Chrome again only exposes stale YouTube navigation menu with screenshot unavailable. Extension browser present (id1/profile1) but new Cloud tab timed out on CDP Runtime.evaluate. No claim of submission.


## Einreichung abgeschlossen — 2026-09-19T09:53:38.777670+02:00

Auf ausdrückliche Bestätigung des Nutzers wurden beide Erklärungen im Überprüfungsfragebogen bestätigt und „Zur Prüfung einreichen“ ausgeführt. Die Google Cloud Console zeigt anschließend im Überprüfungscenter für Projekt wirewire: „Der Datenzugriff Ihrer Anwendung wird überprüft.“ Branding ist bereits überprüft. Dies ist eine erfolgreiche Einreichung, noch keine Genehmigung.

Eingereichtes Demovideo: https://youtu.be/cW6HNr2X_-Q
