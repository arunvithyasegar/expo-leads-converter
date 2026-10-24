"""
Anna Incubator ETM 2026 CRM - Excel Database Engine
Maintains the master Excel workbook (data/etm_database.xlsx) with real-time
synchronization of audio transcripts, recordings, attendee leads, and audit logs.
"""

import os
import json
import shutil
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Styles for Excel Database
THEME_HEADER_FILL = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")  # Teal 800
THEME_HEADER_FONT = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
THEME_TITLE_FONT = Font(name="Segoe UI", size=13, bold=True, color="0F766E")
DATA_FONT = Font(name="Segoe UI", size=10)
BOLD_DATA_FONT = Font(name="Segoe UI", size=10, bold=True)
MUTED_DATA_FONT = Font(name="Segoe UI", size=9, color="64748B")

THIN_BORDER_SIDE = Side(border_style="thin", color="E2E8F0")
CELL_BORDER = Border(left=THIN_BORDER_SIDE, right=THIN_BORDER_SIDE, top=THIN_BORDER_SIDE, bottom=THIN_BORDER_SIDE)

def apply_header_styles(ws, headers):
    ws.append(headers)
    header_row_idx = ws.max_row
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=header_row_idx, column=col_idx)
        cell.fill = THEME_HEADER_FILL
        cell.font = THEME_HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = CELL_BORDER
    ws.row_dimensions[header_row_idx].height = 26
    ws.freeze_panes = f"A{header_row_idx + 1}"

def auto_fit_columns(ws, max_cols=None, max_width=60):
    num_cols = max_cols or ws.max_column
    for col_idx in range(1, num_cols + 1):
        col_letter = get_column_letter(col_idx)
        max_len = 0
        for cell in ws[col_letter]:
            val = str(cell.value or "")
            if "\n" in val:
                val = max(val.split("\n"), key=len)
            max_len = max(max_len, len(val))
        calc_width = min(max(max_len + 3, 12), max_width)
        ws.column_dimensions[col_letter].width = calc_width

def sync_excel_database(data_dir, excel_filename="etm_database.xlsx"):
    """
    Builds or updates the master Excel database file (etm_database.xlsx)
    incorporating all attendee leads, audio recordings, complete transcript texts,
    timestamped segments, activities, and controlled vocabulary lists.
    """
    os.makedirs(data_dir, exist_ok=True)
    excel_path = os.path.join(data_dir, excel_filename)
    tmp_excel_path = os.path.join(data_dir, f"{excel_filename}.tmp")

    # Load JSON files
    leads_path = os.path.join(data_dir, "leads.json")
    recordings_path = os.path.join(data_dir, "recordings.json")
    activities_path = os.path.join(data_dir, "activities.json")
    transcripts_dir = os.path.join(data_dir, "transcripts")

    leads = []
    if os.path.exists(leads_path):
        try:
            with open(leads_path, "r", encoding="utf-8") as f:
                leads = json.load(f)
        except Exception:
            leads = []

    recordings = []
    if os.path.exists(recordings_path):
        try:
            with open(recordings_path, "r", encoding="utf-8") as f:
                recordings = json.load(f)
        except Exception:
            recordings = []

    activities = []
    if os.path.exists(activities_path):
        try:
            with open(activities_path, "r", encoding="utf-8") as f:
                activities = json.load(f)
        except Exception:
            activities = []

    # Map leads by leadId for quick lookup
    leads_map = {l.get("leadId"): l for l in leads if l.get("leadId")}

    # Read transcript files for recordings
    transcripts_map = {}
    for rec in recordings:
        rec_id = rec.get("recordingId")
        lead_id = rec.get("leadId")
        if not rec_id:
            continue

        trans_rel = rec.get("transcriptRelativePath")
        trans_data = None
        if trans_rel:
            abs_trans = os.path.join(data_dir, trans_rel)
            if os.path.isfile(abs_trans):
                try:
                    with open(abs_trans, "r", encoding="utf-8") as f:
                        trans_data = json.load(f)
                except Exception:
                    pass

        # Fallback search if path missing or relative
        if not trans_data and lead_id:
            for root, _, files in os.walk(transcripts_dir):
                if f"{rec_id}.json" in files:
                    try:
                        with open(os.path.join(root, f"{rec_id}.json"), "r", encoding="utf-8") as f:
                            trans_data = json.load(f)
                            break
                    except Exception:
                        pass

        if not trans_data:
            trans_data = {
                "recordingId": rec_id,
                "leadId": lead_id,
                "status": rec.get("transcriptionStatus", "pending"),
                "fullText": rec.get("fullText", ""),
                "editedText": rec.get("editedText", ""),
                "segments": []
            }

        transcripts_map[rec_id] = trans_data

    # Map latest transcript to leads for enrichment
    latest_lead_transcript = {}
    lead_transcript_counts = {}
    for rec in sorted(recordings, key=lambda r: r.get("createdAt", ""), reverse=False):
        lid = rec.get("leadId")
        if not lid:
            continue
        lead_transcript_counts[lid] = lead_transcript_counts.get(lid, 0) + 1
        tdata = transcripts_map.get(rec.get("recordingId"), {})
        text = tdata.get("editedText") or tdata.get("fullText") or ""
        if text:
            latest_lead_transcript[lid] = text

    # Create Workbook
    wb = openpyxl.Workbook()
    
    # -------------------------------------------------------------
    # Sheet 1: Transcripts (Complete Audio Transcription Database)
    # -------------------------------------------------------------
    ws_transcripts = wb.active
    ws_transcripts.title = "Transcripts"

    trans_headers = [
        "RecordingID",
        "LeadID",
        "AttendeeName",
        "Organisation",
        "RecordedAt",
        "DurationSeconds",
        "Language",
        "TranscriptionStatus",
        "WhishperJobID",
        "FullTranscriptText",
        "EditedTranscriptText",
        "SummaryNotes",
        "AudioRelativePath",
        "StaffOwner"
    ]
    apply_header_styles(ws_transcripts, trans_headers)

    for rec in recordings:
        rec_id = rec.get("recordingId", "")
        lead_id = rec.get("leadId", "")
        lead = leads_map.get(lead_id, {})
        tdata = transcripts_map.get(rec_id, {})

        full_txt = tdata.get("fullText", "")
        edited_txt = tdata.get("editedText", "")
        effective_txt = edited_txt or full_txt

        summary = ""
        if effective_txt:
            summary = effective_txt[:140] + ("..." if len(effective_txt) > 140 else "")

        row = [
            rec_id,
            lead_id,
            lead.get("fullName", "Attendee"),
            lead.get("organisation", "Organisation"),
            rec.get("createdAt", ""),
            rec.get("durationSeconds", 0.0),
            rec.get("language", "auto"),
            rec.get("transcriptionStatus", "pending"),
            rec.get("whishperJobId", ""),
            full_txt,
            edited_txt,
            summary,
            rec.get("audioRelativePath", ""),
            rec.get("createdBy", "Staff")
        ]
        ws_transcripts.append(row)
        curr_row = ws_transcripts.max_row
        for c_idx in range(1, len(row) + 1):
            cell = ws_transcripts.cell(row=curr_row, column=c_idx)
            cell.font = DATA_FONT
            cell.border = CELL_BORDER
            if c_idx in (10, 11):  # Transcript text columns
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            else:
                cell.alignment = Alignment(vertical="top")

    auto_fit_columns(ws_transcripts, max_cols=len(trans_headers), max_width=75)
    ws_transcripts.column_dimensions["J"].width = 75  # FullTranscriptText
    ws_transcripts.column_dimensions["K"].width = 75  # EditedTranscriptText

    # -------------------------------------------------------------
    # Sheet 2: TranscriptSegments (Detailed Turn-by-Turn Segments)
    # -------------------------------------------------------------
    ws_segments = wb.create_sheet(title="TranscriptSegments")
    seg_headers = [
        "RecordingID",
        "LeadID",
        "SegmentIndex",
        "StartTime",
        "EndTime",
        "DurationSec",
        "Speaker",
        "SegmentText"
    ]
    apply_header_styles(ws_segments, seg_headers)

    for rec in recordings:
        rec_id = rec.get("recordingId", "")
        lead_id = rec.get("leadId", "")
        tdata = transcripts_map.get(rec_id, {})
        segments = tdata.get("segments") or []

        # If no explicit segments, synthesize one from full text
        if not segments and (tdata.get("fullText") or tdata.get("editedText")):
            segments = [{
                "id": 1,
                "start": 0.0,
                "end": float(rec.get("durationSeconds") or 1.0),
                "speaker": "Speaker",
                "text": tdata.get("editedText") or tdata.get("fullText")
            }]

        for idx, seg in enumerate(segments, start=1):
            start_val = float(seg.get("start", 0.0) or 0.0)
            end_val = float(seg.get("end", 0.0) or 0.0)
            dur = max(0.0, round(end_val - start_val, 2))
            txt = (seg.get("text") or "").strip()
            speaker = seg.get("speaker") or "Speaker"

            row = [
                rec_id,
                lead_id,
                idx,
                f"{start_val:.2f}s",
                f"{end_val:.2f}s",
                dur,
                speaker,
                txt
            ]
            ws_segments.append(row)
            curr_row = ws_segments.max_row
            for c_idx in range(1, len(row) + 1):
                cell = ws_segments.cell(row=curr_row, column=c_idx)
                cell.font = DATA_FONT
                cell.border = CELL_BORDER
                if c_idx == 8:
                    cell.alignment = Alignment(vertical="top", wrap_text=True)
                else:
                    cell.alignment = Alignment(vertical="top")

    auto_fit_columns(ws_segments, max_cols=len(seg_headers), max_width=75)
    ws_segments.column_dimensions["H"].width = 75

    # -------------------------------------------------------------
    # Sheet 3: Recordings (Audio Metadata Directory)
    # -------------------------------------------------------------
    ws_recordings = wb.create_sheet(title="Recordings")
    rec_headers = [
        "RecordingID",
        "LeadID",
        "CreatedAt",
        "CreatedBy",
        "DurationSeconds",
        "AudioSizeBytes",
        "AudioRelativePath",
        "AudioChecksum",
        "TranscriptionStatus",
        "WhishperJobID",
        "TranscriptRelativePath",
        "Language",
        "CompletedAt",
        "TranscriptPreview",
        "ErrorMessage",
        "EditedTranscriptAt"
    ]
    apply_header_styles(ws_recordings, rec_headers)

    for rec in recordings:
        rec_id = rec.get("recordingId", "")
        tdata = transcripts_map.get(rec_id, {})
        txt = tdata.get("editedText") or tdata.get("fullText") or ""
        preview = (txt[:120] + "...") if len(txt) > 120 else txt

        row = [
            rec.get("recordingId", ""),
            rec.get("leadId", ""),
            rec.get("createdAt", ""),
            rec.get("createdBy", ""),
            rec.get("durationSeconds", ""),
            rec.get("audioSizeBytes", ""),
            rec.get("audioRelativePath", ""),
            rec.get("audioChecksum", ""),
            rec.get("transcriptionStatus", ""),
            rec.get("whishperJobId", ""),
            rec.get("transcriptRelativePath", ""),
            rec.get("language", ""),
            rec.get("completedAt", ""),
            preview,
            rec.get("errorMessage", ""),
            rec.get("editedTranscriptAt", "")
        ]
        ws_recordings.append(row)
        curr_row = ws_recordings.max_row
        for c_idx in range(1, len(row) + 1):
            cell = ws_recordings.cell(row=curr_row, column=c_idx)
            cell.font = DATA_FONT
            cell.border = CELL_BORDER
            cell.alignment = Alignment(vertical="top")

    auto_fit_columns(ws_recordings, max_cols=len(rec_headers), max_width=60)

    # -------------------------------------------------------------
    # Sheet 4: Leads (Attendee CRM Directory with Audio Notes)
    # -------------------------------------------------------------
    ws_leads = wb.create_sheet(title="Leads")
    lead_headers = [
        "LeadID", "CreatedAt", "UpdatedAt", "FullName", "JobTitle", "Email", "Phone",
        "PreferredContactMethod", "Country", "PreferredLanguage", "Organisation",
        "OrganisationType", "OrganisationWebsite", "OrganisationLocation", "OrganisationSize",
        "IncubationInterest", "IdeaTitle", "PrimarySector", "IdeaPitch", "IncubationSupport", "IPStatus",
        "Sectors", "Source", "InteractionDate", "EventTracks", "CollaborationInterests",
        "ProblemOrNeed", "CapabilityOffered", "ReadinessLevel", "EstimatedValue", "Currency",
        "Priority", "Stage", "StageChangedAt", "Owner", "NextAction", "FollowUpDate",
        "FollowUpOutcome", "ClosedReason", "ConversionDate", "Consent", "ConsentAt",
        "ConsentMethod", "ConsentNotes", "Notes", "ArchivedAt",
        "TotalTimeSpentSeconds", "TotalTimeSpentFormatted",
        "AudioRecordingsCount", "LatestAudioTranscript"
    ]
    apply_header_styles(ws_leads, lead_headers)

    for lead in leads:
        lid = lead.get("leadId", "")
        sectors_val = "; ".join(lead["sectors"]) if isinstance(lead.get("sectors"), list) else (lead.get("sectors") or "")
        tracks_val = "; ".join(lead["eventTracks"]) if isinstance(lead.get("eventTracks"), list) else (lead.get("eventTracks") or "")
        interests_val = "; ".join(lead["collaborationInterests"]) if isinstance(lead.get("collaborationInterests"), list) else (lead.get("collaborationInterests") or "")
        support_val = "; ".join(lead["incubationSupport"]) if isinstance(lead.get("incubationSupport"), list) else (lead.get("incubationSupport") or "")

        lead_transcript = latest_lead_transcript.get(lid, "")
        transcript_count = lead_transcript_counts.get(lid, 0)

        # Merge transcript into Notes if not already present
        notes_val = lead.get("notes") or ""
        if lead_transcript and lead_transcript not in notes_val:
            notes_val = f"{notes_val}\n[Audio Transcript]: {lead_transcript}".strip()

        spent_sec = int(lead.get("totalTimeSpentSeconds") or 0)
        formatted_spent = f"{spent_sec//60}m {spent_sec%60:02d}s" if spent_sec > 0 else "0m 00s"

        row = [
            lid,
            lead.get("createdAt", ""),
            lead.get("updatedAt", ""),
            lead.get("fullName", ""),
            lead.get("jobTitle", ""),
            lead.get("email", ""),
            lead.get("phone", ""),
            lead.get("preferredContactMethod", "Email"),
            lead.get("country", "India"),
            lead.get("preferredLanguage", ""),
            lead.get("organisation", ""),
            lead.get("organisationType", "Other"),
            lead.get("organisationWebsite", ""),
            lead.get("organisationLocation", ""),
            lead.get("organisationSize", ""),
            lead.get("incubationInterest", ""),
            lead.get("ideaTitle", ""),
            lead.get("primarySector", ""),
            lead.get("ideaPitch", ""),
            support_val,
            lead.get("ipStatus", ""),
            sectors_val,
            lead.get("source", "ETM 2026 – in person"),
            lead.get("interactionDate", ""),
            tracks_val,
            interests_val,
            lead.get("problemOrNeed", ""),
            lead.get("capabilityOffered", ""),
            lead.get("readinessLevel", ""),
            lead.get("estimatedValue", ""),
            lead.get("currency", "INR (₹)"),
            lead.get("priority", "Normal"),
            lead.get("stage", "New"),
            lead.get("stageChangedAt", ""),
            lead.get("owner", ""),
            lead.get("nextAction", ""),
            lead.get("followUpDate", ""),
            lead.get("followUpOutcome", ""),
            lead.get("closedReason", ""),
            lead.get("conversionDate", ""),
            lead.get("consent", "No"),
            lead.get("consentAt", ""),
            lead.get("consentMethod", ""),
            lead.get("consentNotes", ""),
            notes_val,
            lead.get("archivedAt", ""),
            spent_sec,
            formatted_spent,
            transcript_count,
            lead_transcript
        ]
        ws_leads.append(row)
        curr_row = ws_leads.max_row
        for c_idx in range(1, len(row) + 1):
            cell = ws_leads.cell(row=curr_row, column=c_idx)
            cell.font = DATA_FONT
            cell.border = CELL_BORDER
            cell.alignment = Alignment(vertical="top")

    auto_fit_columns(ws_leads, max_cols=len(lead_headers), max_width=50)

    # -------------------------------------------------------------
    # Sheet 5: Activities (Chronological Audit Trail & Transcripts)
    # -------------------------------------------------------------
    ws_activities = wb.create_sheet(title="Activities")
    act_headers = [
        "ActivityID", "LeadID", "ActivityType", "ActivityAt", "Owner",
        "Summary", "Outcome", "TranscriptText", "NextAction", "FollowUpDate"
    ]
    apply_header_styles(ws_activities, act_headers)

    for act in activities:
        transcript_val = act.get("transcript") or (act.get("outcome") if "transcript" in (act.get("summary") or "").lower() else "")
        row = [
            act.get("activityId", ""),
            act.get("leadId", ""),
            act.get("activityType", "Note"),
            act.get("activityAt", ""),
            act.get("owner", "Staff"),
            act.get("summary", ""),
            act.get("outcome", ""),
            transcript_val,
            act.get("nextAction", ""),
            act.get("followUpDate", "")
        ]
        ws_activities.append(row)
        curr_row = ws_activities.max_row
        for c_idx in range(1, len(row) + 1):
            cell = ws_activities.cell(row=curr_row, column=c_idx)
            cell.font = DATA_FONT
            cell.border = CELL_BORDER
            if c_idx in (7, 8):  # Outcome and TranscriptText
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            else:
                cell.alignment = Alignment(vertical="top")

    auto_fit_columns(ws_activities, max_cols=len(act_headers), max_width=75)
    ws_activities.column_dimensions["H"].width = 70

    # -------------------------------------------------------------
    # Sheet 6: Lists (Controlled Vocabularies)
    # -------------------------------------------------------------
    ws_lists = wb.create_sheet(title="Lists")
    list_columns = {
        "OrganisationTypes": ["Startup", "Industry / Corporate", "Academic / R&D", "Government / PSU", "Investor / VC", "Other"],
        "IncubationInterests": [
            "Full Incubation (Early Stage / Cohort)",
            "Pre-Incubation (Ideation & Validation)",
            "Seeking Pilot Host & Commercialisation (PSU Connects)",
            "Seeking Lab & Testing Facilities (Anna University)",
            "Corporate / Industry Partner",
            "Visitor / Not Interested"
        ],
        "Stages": ["New", "Attempting contact", "Contacted", "Qualified", "Meeting scheduled", "In discussion", "Proposal / pilot planning", "Opportunity", "Converted", "Nurture", "Closed – successful", "Closed – no action"],
        "Sectors": [
            "Biofuels & 2G Bio-refining",
            "Green Hydrogen & Fuel Cells",
            "Carbon Capture & CCUS",
            "Solar & Renewable Energy",
            "Industrial Decarbonisation",
            "Refinery Digitisation & AI",
            "Compressed Biogas (CBG)",
            "Energy Storage & Batteries",
            "Circular Economy & Waste Valorisation",
            "Industrial Water & Effluent Treatment"
        ],
        "IPStatuses": [
            "Patent Granted",
            "Patent Applied / Pending",
            "Provisional Patent Filed",
            "Trade Secret / Proprietary Know-How",
            "Open Source / Academic",
            "Not Disclosed"
        ],
        "EventTracks": ["Refining and industrial excellence", "Future fuels and biotechnology", "Research and enterprise"],
        "CollaborationInterests": ["Incubation & Coworking", "Pilot Plant & Lab Access", "Corporate Joint Development", "Academic Grant Collaboration", "Mentorship & Acceleration", "Investment & Seed Funding"],
        "LeadSources": ["ETM 2026 – in person", "ETM 2026 – booth walk-in", "ETM 2026 – conference session", "Website inquiry", "Referral", "LinkedIn / Social", "Email inbound", "Partner network"],
        "Priorities": ["Strategic", "High", "Normal", "Low"],
        "ConsentOptions": ["Yes", "No", "Not asked"]
    }

    list_headers = list(list_columns.keys())
    apply_header_styles(ws_lists, list_headers)

    max_rows = max(len(vals) for vals in list_columns.values())
    for r in range(max_rows):
        row_vals = [list_columns[col][r] if r < len(list_columns[col]) else "" for col in list_headers]
        ws_lists.append(row_vals)
        curr_row = ws_lists.max_row
        for c_idx in range(1, len(row_vals) + 1):
            cell = ws_lists.cell(row=curr_row, column=c_idx)
            cell.font = DATA_FONT
            cell.border = CELL_BORDER

    auto_fit_columns(ws_lists, max_cols=len(list_headers), max_width=40)

    # -------------------------------------------------------------
    # Sheet 7: Users (Staff Directory)
    # -------------------------------------------------------------
    ws_users = wb.create_sheet(title="Users")
    user_headers = ["UserID", "Name", "Email", "Role", "Active"]
    apply_header_styles(ws_users, user_headers)

    default_users = [
        ["USR-001", "Dr. R. Ramanathan", "director@anna-incubator.org", "Director", "Yes"],
        ["USR-002", "Priya Nair", "priya.nair@anna-incubator.org", "Corporate Partnerships", "Yes"],
        ["USR-003", "Karthik S.", "karthik.s@anna-incubator.org", "Scout & Mentorship", "Yes"],
        ["USR-004", "Ananya Roy", "ananya.roy@anna-incubator.org", "Incubation Manager", "Yes"],
        ["USR-005", "Event Desk Team", "desk@anna-incubator.org", "Event Desk", "Yes"]
    ]
    for u in default_users:
        ws_users.append(u)
        curr_row = ws_users.max_row
        for c_idx in range(1, len(u) + 1):
            cell = ws_users.cell(row=curr_row, column=c_idx)
            cell.font = DATA_FONT
            cell.border = CELL_BORDER

    auto_fit_columns(ws_users, max_cols=len(user_headers), max_width=35)

    # Save atomically
    wb.save(tmp_excel_path)
    os.replace(tmp_excel_path, excel_path)
    return excel_path

def get_database_info(data_dir, excel_filename="etm_database.xlsx"):
    """Returns metadata and statistics about the master Excel database."""
    excel_path = os.path.join(data_dir, excel_filename)
    if not os.path.exists(excel_path):
        sync_excel_database(data_dir, excel_filename)

    recordings_file = os.path.join(data_dir, "recordings.json")
    leads_file = os.path.join(data_dir, "leads.json")

    total_recordings = 0
    total_leads = 0

    if os.path.exists(recordings_file):
        try:
            with open(recordings_file, "r", encoding="utf-8") as f:
                total_recordings = len(json.load(f))
        except Exception:
            pass

    if os.path.exists(leads_file):
        try:
            with open(leads_file, "r", encoding="utf-8") as f:
                total_leads = len(json.load(f))
        except Exception:
            pass

    file_size = os.path.getsize(excel_path) if os.path.exists(excel_path) else 0
    mtime = datetime.fromtimestamp(os.path.getmtime(excel_path)).isoformat() if os.path.exists(excel_path) else ""

    return {
        "exists": os.path.exists(excel_path),
        "filePath": excel_path,
        "relativePath": f"data/{excel_filename}",
        "fileSizeBytes": file_size,
        "fileSizeFormatted": f"{file_size / 1024:.1f} KB" if file_size < 1024*1024 else f"{file_size / (1024*1024):.2f} MB",
        "lastModified": mtime,
        "totalRecordings": total_recordings,
        "totalLeads": total_leads,
        "sheets": ["Transcripts", "TranscriptSegments", "Recordings", "Leads", "Activities", "Lists", "Users"]
    }
