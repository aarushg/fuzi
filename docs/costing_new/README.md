# Lift Costing Calculator

This folder contains a Flask web app for calculating lift costing from the 6-passenger source spreadsheets and the rules documented in `costing.md`.

## Current Source Coverage

The app is validated against the 14 workbooks in `6 passenger costing`.

Only 6-passenger costing is currently source-backed. Other passenger capacities should not be added to the UI until matching spreadsheets are provided and verified.

## User-Facing Parameters

- Vision:
  - Small / Non vision
  - Big vision glass door
- Material:
  - Mild Steel
  - Stainless Steel
  - Rose Gold (RG) / Golden
- Motor Type:
  - Geared motor
  - Gearless motor
- Door:
  - Auto door
  - Manual door

## Speed Rule

- Geared motor: `0.65 mps`
- Gearless motor: `1.0 mps`

Speed is calculated from motor type. It should not be manually edited.

## RG / Golden Source Note

The source spreadsheets include RG/Golden files with mild-steel and stainless-steel wording in the filenames. In the calculator, RG/Golden is a user-facing material option. The calculator uses the RG/Golden stainless-source rates as the main RG/Golden app option, while source verification still checks all 14 spreadsheets.

## Run

From this folder:

```powershell
C:\Users\User\Documents\GitHub\fuzi\.venv\Scripts\python.exe costing_app.py
```

Open:

```text
http://127.0.0.1:5055/
```

## Verify Source Spreadsheets

The app keeps a verification endpoint for checking the calculator against the spreadsheet scenarios:

```text
http://127.0.0.1:5055/api/verify
```

Expected result with the current source files: 14 spreadsheet scenarios checked.
