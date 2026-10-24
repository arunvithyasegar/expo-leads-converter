# Anna Incubator · ETM 2026 Lead Conversion CRM

A reliable, responsive CRM web application built for Anna Incubator staff to capture attendee leads and convert event conversations into tracked follow-up opportunities during the **29th Energy Technology & Innovation Meet (ETM 2026)** held in Goa from 27–29 October 2026.

---

## Key Features

1. **Executive Dashboard:**
   - 8 live summary metric cards (Total Leads, New Leads, Follow-ups Due Today, Overdue Follow-ups, Meetings Scheduled, Active Opportunities, Converted Leads, Leads with No Consent).
   - Interactive Conversion Pipeline Funnel with stage counts and estimated deal values (one-click filtering).
   - Priority Follow-up Queue sorted by urgency and priority.
   - Real-time Activity History Stream & Audit Trail.

2. **Lead Directory & Advanced Filtering:**
   - Full-text search across Name, Email, Phone, Organisation, Notes, and Owner.
   - Quick Filter Chips (Saved Views: *All Contacts*, *Overdue Follow-ups*, *Due Today*, *High-Priority Opportunities*, *Needs Consent Review*, *Startups*, *Industry & Energy Companies*, *Converted*).
   - Advanced filter drawer (Stage, Owner, Organisation Type, Sector, Collaboration Interest, Consent, Source, Priority).
   - Batch selection actions: Export selected to Excel or clear selection.
   - Direct inline quick stage changes and row actions (View Profile, Log Activity, Edit, Delete/Archive).

3. **Comprehensive Lead Profile:**
   - Visual 12-stage pipeline stepper with one-click transitions.
   - High-visibility **Consent Warning Banner** (green verified badge vs. prominent red warning when consent is No or Not Asked).
   - Full contact details, organisation profile, and sector specialisations.
   - ETM 2026 thematic tracks, collaboration interests, problem/need, capability offered, readiness level (TRL), and estimated opportunity value.
   - **Chronological Activity History Timeline** of notes, calls, emails, meetings, and stage changes.
   - **Related Contacts from Same Organisation** automatic matching widget.

4. **Conference-Desk Fast Capture & Duplicate Prevention:**
   - Clean, fast-entry form with field-level inline validation.
   - Multi-tier duplicate detection:
     1. Normalized Email
     2. Normalized Phone
     3. Name + Organisation combination
   - **Duplicate Resolution Modal**: Side-by-side comparison of Existing vs. Incoming data with explicit choices:
     - *Open & Update Existing Lead*
     - *Merge Information* (combines notes, unions sectors/interests, updates contact details, creates audit log)
     - *Keep Separate as New Person*

5. **Follow-up Action Manager (Task View):**
   - 4 tabbed buckets: **Overdue**, **Today**, **Upcoming**, and **Completed**.
   - Quick card actions: Record outcome & mark complete, reschedule date, or open lead profile.

6. **Excel Workbook Backend & Sync Engine:**
   - Generates a complete 4-sheet `.xlsx` workbook:
     - `Leads`: 40 standardized columns with multi-select fields serialized as semicolon-delimited text.
     - `Activities`: Chronological log (`ActivityID, LeadID, ActivityType, ActivityAt, Owner, Summary, Outcome, NextAction, FollowUpDate`).
     - `Lists`: Controlled vocabularies for dropdowns, sectors, stages, and tracks.
     - `Users`: Staff member assignment directory.
   - CSV export for quick tabular reporting.
   - Drag-and-drop file import with column mapping preview, row-level validation error reports, and conflict identification.
   - Automatic pre-import snapshot and full JSON backup/restore.
   - Clear multi-user sync clarification banner explaining safe handoff vs. simultaneous shared database paths.

---

## How to Run Locally

The application is self-contained and runs with either **Python 3** (recommended on Windows) or **Node.js**:

### Option A: Using Python (Available out-of-the-box)
```bash
python server.py
# or: npm run start:py
```
Open **`http://127.0.0.1:8080`** (or the port displayed in your terminal).

### Option B: Using Node.js
```bash
npm start
# or: node server.js
```
Open **`http://127.0.0.1:4173`** (or fallback port if 4173 is in use).

### Standalone Browser Mode:
The frontend can also run directly from `index.html` in Microsoft Edge or Google Chrome; data persists immediately in `localStorage` with full Excel and JSON export/import support.

---

## Workbook Schema (`.xlsx`)

### 1. `Leads` Sheet (40 Standard Columns)
`LeadID, CreatedAt, UpdatedAt, FullName, JobTitle, Email, Phone, PreferredContactMethod, Country, PreferredLanguage, Organisation, OrganisationType, OrganisationWebsite, OrganisationLocation, OrganisationSize, Sectors, Source, InteractionDate, EventTracks, CollaborationInterests, ProblemOrNeed, CapabilityOffered, ReadinessLevel, EstimatedValue, Currency, Priority, Stage, StageChangedAt, Owner, NextAction, FollowUpDate, FollowUpOutcome, ClosedReason, ConversionDate, Consent, ConsentAt, ConsentMethod, ConsentNotes, Notes, ArchivedAt`

### 2. `Activities` Sheet
`ActivityID, LeadID, ActivityType, ActivityAt, Owner, Summary, Outcome, NextAction, FollowUpDate`

### 3. `Lists` Sheet
Controlled dropdown vocabularies: Organisation Types, Stages, Sectors, Event Tracks, Collaboration Interests, Lead Sources, Priorities, Consent Options, Contact Methods, Closed Reasons.

### 4. `Users` Sheet
`UserID, Name, Email, Role, Active`

---

## Data Privacy & Consent Policy

- **Mandatory Consent Check:** Outbound follow-ups (emails, calls) must **never** be initiated when consent is `No` or `Not asked`.
- **Prominent Warnings:** Unconsented leads are highlighted in red across the dashboard, lead directory, and task view.
- **Data Minimisation:** Sensitive personal information (passwords, bank details, Aadhaar/SSN) is strictly excluded.
- **Retention Procedure:** Event leads are retained for 180 days post-ETM 2026. Staff can archive or permanently delete attendee records upon request.

---

## Local Whishper Audio Recording & Transcription

The CRM integrates local in-browser microphone capture with the open-source **[Whishper](https://github.com/pluja/whishper)** local transcription engine.

### 1. Privacy, Local-Only Architecture & AGPL-3.0 Compliance
- **Zero Cloud Dependence:** Audio is never uploaded to OpenAI, Microsoft Azure, Google Cloud Speech, or any external third-party API.
- **Self-Hosted Service:** Whishper runs as an independent local Docker container or process on `http://127.0.0.1:8082`.
- **CRM Integration Boundary:** The CRM communicates with Whishper strictly over internal loopback HTTP via clean adapter modules (`whishper_client.py` and `whishper_client.js`). Whishper source code is not bundled or combined into the CRM codebase, ensuring strict compliance with Whishper's **AGPL-3.0** license.
- **Offline Reliability:** If Whishper is stopped or unavailable, staff can still record conversations, confirm consent, save audio locally to disk, and replay recordings. The CRM queues jobs with an `offline` / `pending` status and provides a one-click **Retry** button once Whishper is back online.

### 2. Verified Whishper Version
- **Selected Tag:** `v3.1.4`
- **Commit:** `5fe8e483f61446429aad3af0546d11b7ded6e78f`
- **Version Evaluation:**
  - `v3.1.4` is the official, stable release tag featuring prebuilt production Docker images (`pluja/whishper:v3.1.4`), verified faster-whisper acceleration, and standardized REST endpoints.
  - The repository's `v4` rewrite ("anysub") was inspected and determined to be an experimental work-in-progress without published production images. It was intentionally rejected in favor of verified stability.
- **Verified Integration Contract:**
  - `POST /api/transcriptions` — Multipart upload containing audio file, `modelSize`, `language`, and `device` (`cpu`/`cuda`). Returns `{ "id": "<job_id>" }`.
  - `GET /api/transcriptions/:id` — Job status query returning integer status: `0` (Pending), `1` (Running), `2` (Completed), `-1` (Failed), accompanied by text segments and timing.
  - `GET /api/transcriptions` — Health and job listing check.
  - `DELETE /api/transcriptions/:id` — Remote job deletion.
  - *Fallback Compatibility:* The adapter also auto-detects and supports the standalone FastAPI worker (`/transcribe/` + `/healthcheck/`).

### 3. Quickstart: Running Local Whishper
Run Whishper via Docker Compose using the included configuration:
```bash
docker compose -f docker-compose.whishper.yml up -d
```
Check health from your terminal:
```bash
curl http://127.0.0.1:8082/api/transcriptions
```
Or check the header status pill inside the CRM:
- 🟢 **Whishper: Online (v3.1.4)** — Engine active and ready for automatic transcription.
- 🟡 **Whishper: Standby (Local)** — Whishper service is stopped; recordings will be preserved locally on disk.

### 4. Configuration & Environment Variables
Copy `.env.example` to `.env` to configure paths and endpoints:
```ini
ETM_DATA_DIR=./data
PORT=8080
WHISHPER_BASE_URL=http://127.0.0.1:8082
WHISHPER_API_KEY=
```

### 5. Local Storage Structure
Audio recordings and transcripts are stored strictly outside the publicly served web directory:
```
data/
├── leads.json                     # Local JSON lead database
├── activities.json                # Audit trail and interaction timeline
├── recordings.json                # Recording metadata entities
├── recordings/
│   └── <LeadID>/
│       └── <YYYY>/
│           └── <datetime>_<safe-organisation>_<RecordingID>.webm
├── transcripts/
│   └── <LeadID>/
│       └── <YYYY>/
│           ├── <RecordingID>.json # Normalized CRM transcript record
│           ├── <RecordingID>.txt  # Plain-text transcript
│           ├── <RecordingID>.vtt  # WebVTT subtitle track
│           ├── <RecordingID>.srt  # SubRip subtitle track
│           └── <RecordingID>_raw.json # Original Whishper model output
└── backups/                       # Timestamped database snapshots
```

### 6. Recording & Transcript Workflow
1. **Consent Gate:** Staff opens any lead profile and clicks **+ Record Conversation**. The dialog requires an explicit check of the affirmative consent checkbox (*"I confirm that all participants have been clearly informed and affirmatively agree..."*) before microphone capture can be initiated.
2. **In-Browser Recording:** The Web Audio `MediaRecorder` captures audio in standard Opus WebM format. Controls include live timer, Pause, Resume, Stop & Save, and Cancel (with before-unload warning).
3. **Atomic Persistence:** Upon clicking Stop, audio is transmitted to the CRM server and written atomically (`.tmp` -> rename) under `data/recordings/<LeadID>/<YYYY>/...`.
4. **Automatic Whishper Dispatch:** The CRM server queues the audio file with the local Whishper engine without exposing internal endpoints to the browser.
5. **Background Polling:** A background poller checks job status every 4 seconds, writes normalized transcripts, and generates `.txt`, `.vtt`, `.srt`, and raw JSON.
6. **In-CRM Playback & Editing:** Staff can listen to audio with smooth range seeking (HTTP 206 Partial Content), inspect interactive timestamped segments, edit transcript text inline, and download in multiple formats.
7. **Excel Metadata Export:** All recording metadata is exported to the 5th sheet (`Recordings`) of the Excel workbook. Raw audio bytes are never embedded in Excel.

### 7. Automated Test Suite
Run the automated end-to-end integration test suite verifying all 15 endpoints and workflows:
```bash
python test_recordings_integration.py
```
Output:
```
=== STARTING CRM WHISHPER & RECORDINGS INTEGRATION TESTS ===
[OK] 1. /api/status is healthy: Anna ETM Lead CRM Python Server
[OK] 2. /api/whishper/status returns expected contract
[OK] 3. Target test lead: LEAD-TEST-001
[OK] 4. Recording uploaded: atomic path, generated ID, slugged organization
[OK] 5. Audio saved atomically to local disk
[OK] 6. /api/leads/:leadId/recordings returned lead's recording
[OK] 7. /api/recordings returned in global list
[OK] 8. Audio endpoint supports HTTP 206 Partial Content Range streaming
[OK] 9. /api/recordings/:id/transcription returned normalized structure
[OK] 10. Staff transcript corrections saved atomically to disk
[OK] 11. Format download /audio, /txt, /vtt, /srt, /json verified
[OK] 12. Recording creation and transcript edits logged in Lead Activity History
[OK] 13. Retry transcription queued / offline handled
[OK] 14. DELETE /api/recordings/:id removes file from disk and deletes record
[OK] 15. Recording confirmed purged from database
ALL 15 INTEGRATION TESTS PASSED SUCCESSFULLY! ✅
```
