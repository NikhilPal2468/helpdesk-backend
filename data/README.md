# HSCAP Seed Data Import

## Data format

Place your HSCAP 2025 data in a JSON file with the following structure. All arrays are optional.

```json
{
  "schools": [
    { "code": "SCH001", "name": "School Name (EN)", "nameMl": "School Name (ML)" }
  ],
  "combinations": [
    { "code": "COM001", "name": "Science (PCM)", "nameMl": "..." }
  ],
  "categories": [
    { "code": "GEN", "name": "General", "nameMl": "..." }
  ],
  "districts": [
    { "code": "TVM", "name": "Thiruvananthapuram", "nameMl": "..." }
  ],
  "taluks": [
    { "code": "TVM-01", "name": "Taluk Name", "nameMl": "...", "districtCode": "TVM" }
  ],
  "panchayats": [
    { "code": "TVM-01-001", "name": "Panchayat Name", "nameMl": "...", "talukCode": "TVM-01" }
  ]
}
```

- **code** (required): Unique code per type (e.g. school code, combination code).
- **name** (required): Display name in English.
- **nameMl** (optional): Display name in Malayalam.
- **districtCode** (optional, taluks only): Parent district code.
- **talukCode** (optional, panchayats only): Parent taluk code.

## Run import

From the backend directory:

```bash
npm run import-hscap-data -- data/your-file.json
```

Or with npx:

```bash
npx tsx src/scripts/import-hscap-data.ts data/hscap-data-format.json
```

Existing records with the same `type` and `code` are updated; new records are created.
