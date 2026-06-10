# PhysioPro Osteopathie-Termine

Interne PWA zur Erfassung von Osteopathie-Terminen mit automatischer
E-Mail-Bestätigung (inkl. Ausfallregelung) und E-Mail-Erinnerungen
(3 Tage und 24 h vorher).

## Stack
- Frontend: statische PWA (`public/`)
- Backend: Netlify Functions (`netlify/functions/`)
- Datenbank: Google Sheets (Tab `Termine`)
- E-Mail: Microsoft Graph (Absender `info@physioproluebeck.de`)
- Erinnerungen: Netlify Scheduled Function (Cron, alle 30 Min)

## Logik
- Beim Anlegen: sofortige Bestätigungsmail mit No-Show-Regel.
- 3-Tage-Erinnerung: sobald Termin <=72 h entfernt ist.
- 24h-Erinnerung: sobald Termin <=24 h entfernt ist.
- Kurzfristige Termine: verpasste Stufen werden nachgeholt; jede Stufe sendet nur 1x.
- Ruhezeiten: kein Versand vor 8 / nach 20 Uhr.

## Sicherheitsschalter
`LIVE_MODE` muss exakt `true` sein, damit real versendet wird. Sonst Testmodus (nur Logeintrag).

## Setup
Alle Umgebungsvariablen siehe `.env.example`. Echte Werte ausschließlich in der
Netlify-Site hinterlegen (Site settings -> Environment variables), nie im Repo.

Demo zum Testen ohne Backend: `public/demo.html` lokal im Browser öffnen.
