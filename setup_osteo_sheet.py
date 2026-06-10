#!/usr/bin/env python3
# setup_osteo_sheet.py
# Initialisiert das Google Sheet fuer die Osteopathie-Termine:
#   - benennt den ersten Tab in "Termine" um
#   - schreibt die 14 Spaltenueberschriften in Zeile 1
#
# Voraussetzungen (einmalig):
#   pip install google-auth google-api-python-client
#
# Benoetigt:
#   1. Die SHEET_ID des neu angelegten Google Sheets (aus der URL)
#   2. Den Service Account aus dem Fahrtenbuch:
#        GOOGLE_CLIENT_EMAIL  (Netlify ENV der Fahrtenbuch-App)
#        GOOGLE_PRIVATE_KEY   (Netlify ENV der Fahrtenbuch-App)
#   Das Sheet muss vorher mit der GOOGLE_CLIENT_EMAIL als BEARBEITER geteilt sein.

from google.oauth2 import service_account
from googleapiclient.discovery import build

# ── Eingaben ───────────────────────────────────────────────────
SHEET_ID = input("SHEET_ID (aus der URL des neuen Sheets): ").strip()
CLIENT_EMAIL = input("GOOGLE_CLIENT_EMAIL (aus Fahrtenbuch-ENV): ").strip()
print("GOOGLE_PRIVATE_KEY einfuegen (alles zwischen den Anfuehrungszeichen, inkl. \\n):")
PRIVATE_KEY = input().strip().replace("\\n", "\n")

# ── Auth ───────────────────────────────────────────────────────
creds = service_account.Credentials.from_service_account_info(
    {
        "type": "service_account",
        "client_email": CLIENT_EMAIL,
        "private_key": PRIVATE_KEY,
        "token_uri": "https://oauth2.googleapis.com/token",
    },
    scopes=["https://www.googleapis.com/auth/spreadsheets"],
)
service = build("sheets", "v4", credentials=creds)
ws = service.spreadsheets()

# ── Ersten Tab in "Termine" umbenennen ─────────────────────────
meta = ws.get(spreadsheetId=SHEET_ID).execute()
first_sheet_id = meta["sheets"][0]["properties"]["sheetId"]
ws.batchUpdate(
    spreadsheetId=SHEET_ID,
    body={"requests": [{
        "updateSheetProperties": {
            "properties": {"sheetId": first_sheet_id, "title": "Termine"},
            "fields": "title",
        }
    }]},
).execute()
print("Tab umbenannt -> Termine")

# ── Kopfzeile schreiben (exakt 14 Spalten, Reihenfolge = App-Logik) ─
headers = [[
    "id", "createdAt", "firstName", "lastName", "email", "cc", "phone",
    "date", "time", "practitioner", "note",
    "confirmSent", "reminder3dSent", "reminder24hSent",
]]
ws.values().update(
    spreadsheetId=SHEET_ID,
    range="Termine!A1",
    valueInputOption="RAW",
    body={"values": headers},
).execute()
print("Kopfzeile geschrieben (14 Spalten) ✓")
print("\nFertig. Das Sheet ist startklar.")
print("Diese SHEET_ID in Netlify als Variable SHEET_ID hinterlegen:")
print("  " + SHEET_ID)
