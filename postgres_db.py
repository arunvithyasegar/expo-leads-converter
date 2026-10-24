"""
Anna Incubator ETM 2026 Lead CRM - PostgreSQL Database Engine
Maintains real-time relational mirroring to PostgreSQL for pgAdmin live monitoring.
Supports soft-deletes, automatic table creation, schema views, and fault-tolerant sync.
"""

import os
import json
import logging
from datetime import datetime

logger = logging.getLogger("ETM_Postgres")

try:
    import psycopg2
    from psycopg2 import sql, extras
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    logger.warning("psycopg2 is not installed. PostgreSQL live synchronization will be disabled until installed.")

CONFIG_FILE_NAME = "postgres_config.json"

DEFAULT_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "password": "",
    "dbname": "postgres",
    "auto_create_db": True,
    "target_dbname": "anna_etm_db"
}

def get_config_path(data_dir):
    return os.path.join(data_dir, CONFIG_FILE_NAME)

def load_pg_config(data_dir):
    cfg = dict(DEFAULT_CONFIG)
    # 1. Environment variables take priority
    if os.environ.get("PGHOST"):
        cfg["host"] = os.environ.get("PGHOST")
    if os.environ.get("PGPORT"):
        try:
            cfg["port"] = int(os.environ.get("PGPORT"))
        except ValueError:
            pass
    if os.environ.get("PGUSER"):
        cfg["user"] = os.environ.get("PGUSER")
    if os.environ.get("PGPASSWORD"):
        cfg["password"] = os.environ.get("PGPASSWORD")
    if os.environ.get("PGDATABASE"):
        cfg["dbname"] = os.environ.get("PGDATABASE")

    # 2. Check local config file
    cfg_file = get_config_path(data_dir)
    if os.path.exists(cfg_file):
        try:
            with open(cfg_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    cfg.update({k: v for k, v in saved.items() if v is not None})
        except Exception as e:
            logger.warning(f"Error reading {cfg_file}: {e}")

    return cfg

def save_pg_config(data_dir, new_config):
    os.makedirs(data_dir, exist_ok=True)
    cfg = load_pg_config(data_dir)
    cfg.update(new_config)
    cfg_file = get_config_path(data_dir)
    with open(cfg_file, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    return cfg

def get_connection(data_dir, dbname_override=None, timeout=3):
    if not PSYCOPG2_AVAILABLE:
        raise RuntimeError("psycopg2 is not available. Please install psycopg2-binary.")
    cfg = load_pg_config(data_dir)
    dbname = dbname_override or cfg.get("dbname") or "postgres"
    return psycopg2.connect(
        host=cfg.get("host", "localhost"),
        port=cfg.get("port", 5432),
        user=cfg.get("user", "postgres"),
        password=cfg.get("password", ""),
        dbname=dbname,
        connect_timeout=timeout
    )

def test_connection(data_dir):
    if not PSYCOPG2_AVAILABLE:
        return {"connected": False, "error": "psycopg2-binary not installed in environment"}
    cfg = load_pg_config(data_dir)
    try:
        conn = get_connection(data_dir, timeout=2)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        ver = cur.fetchone()[0]
        cur.close()
        conn.close()
        return {
            "connected": True,
            "version": ver,
            "host": cfg.get("host"),
            "port": cfg.get("port"),
            "user": cfg.get("user"),
            "dbname": cfg.get("dbname")
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "host": cfg.get("host"),
            "port": cfg.get("port"),
            "user": cfg.get("user"),
            "dbname": cfg.get("dbname")
        }

SCHEMA_SQL = """
-- =============================================================================
-- Anna Incubator ETM 2026 - Master PostgreSQL & pgAdmin Relational Schema
-- Supports Live Querying, Soft Deletes, Activity Logs & Complete Transcripts
-- =============================================================================

-- 1. Attendee Leads Directory Table
CREATE TABLE IF NOT EXISTS leads (
    lead_id VARCHAR(64) PRIMARY KEY,
    created_at VARCHAR(64),
    updated_at VARCHAR(64),
    full_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(64),
    preferred_contact_method VARCHAR(64) DEFAULT 'Email',
    country VARCHAR(100) DEFAULT 'India',
    preferred_language VARCHAR(64),
    organisation VARCHAR(255),
    organisation_type VARCHAR(100),
    organisation_website VARCHAR(255),
    organisation_location VARCHAR(255),
    organisation_size VARCHAR(64),
    incubation_interest VARCHAR(255),
    idea_title VARCHAR(255),
    primary_sector VARCHAR(100),
    idea_pitch TEXT,
    incubation_support TEXT,
    ip_status VARCHAR(100),
    sectors TEXT,
    source VARCHAR(100),
    interaction_date VARCHAR(32),
    event_tracks TEXT,
    collaboration_interests TEXT,
    problem_or_need TEXT,
    capability_offered TEXT,
    readiness_level VARCHAR(64),
    estimated_value NUMERIC(15, 2),
    currency VARCHAR(32) DEFAULT 'INR (₹)',
    priority VARCHAR(32) DEFAULT 'Normal',
    stage VARCHAR(64) DEFAULT 'New',
    stage_changed_at VARCHAR(64),
    owner VARCHAR(100),
    next_action TEXT,
    follow_up_date VARCHAR(32),
    follow_up_outcome TEXT,
    closed_reason VARCHAR(255),
    conversion_date VARCHAR(64),
    consent VARCHAR(32) DEFAULT 'No',
    consent_at VARCHAR(64),
    consent_method VARCHAR(100),
    consent_notes TEXT,
    notes TEXT,
    archived_at VARCHAR(64),
    is_deleted BOOLEAN DEFAULT FALSE,
    total_time_spent_seconds INT DEFAULT 0,
    audio_recordings_count INT DEFAULT 0,
    latest_transcript TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Activities & Event Logs Table (Permanent Historical Log - Never Hard Deleted)
CREATE TABLE IF NOT EXISTS activities (
    activity_id VARCHAR(64) PRIMARY KEY,
    lead_id VARCHAR(64),
    activity_type VARCHAR(64) NOT NULL,
    activity_at VARCHAR(64),
    owner VARCHAR(100),
    summary TEXT,
    outcome TEXT,
    transcript TEXT,
    recording_id VARCHAR(64),
    duration_seconds NUMERIC(10, 2),
    audio_relative_path TEXT,
    vtt_relative_path TEXT,
    is_archived_lead BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Audio Recordings Directory Table
CREATE TABLE IF NOT EXISTS recordings (
    recording_id VARCHAR(64) PRIMARY KEY,
    lead_id VARCHAR(64),
    created_at VARCHAR(64),
    created_by VARCHAR(100),
    duration_seconds NUMERIC(10, 2),
    audio_size_bytes BIGINT,
    audio_relative_path TEXT,
    audio_checksum VARCHAR(128),
    transcription_status VARCHAR(64),
    whishper_job_id VARCHAR(128),
    transcript_relative_path TEXT,
    language VARCHAR(32),
    completed_at VARCHAR(64),
    transcript_preview TEXT,
    error_message TEXT,
    edited_transcript_at VARCHAR(64),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Transcripts Table
CREATE TABLE IF NOT EXISTS transcripts (
    transcript_id SERIAL PRIMARY KEY,
    recording_id VARCHAR(64) UNIQUE,
    lead_id VARCHAR(64),
    full_text TEXT,
    edited_text TEXT,
    status VARCHAR(64),
    language VARCHAR(32),
    created_at VARCHAR(64),
    completed_at VARCHAR(64),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. System Audit Trail Table
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id SERIAL PRIMARY KEY,
    log_id VARCHAR(64),
    timestamp VARCHAR(64),
    action VARCHAR(64),
    details TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Dedicated pgAdmin Convenience Views
-- -----------------------------------------------------------------------------

-- View A: Active Dashboard Attendees (Excludes soft-deleted / archived leads)
CREATE OR REPLACE VIEW view_active_dashboard_leads AS
SELECT 
    lead_id, full_name, organisation, organisation_type, job_title,
    primary_sector, stage, priority, owner, estimated_value, currency,
    consent, total_time_spent_seconds, audio_recordings_count, follow_up_date
FROM leads
WHERE is_deleted = FALSE AND (archived_at IS NULL OR archived_at = '');

-- View B: Deleted & Archived Attendees Archive (Preserved historical attendees)
CREATE OR REPLACE VIEW view_deleted_leads_archive AS
SELECT 
    lead_id, full_name, organisation, archived_at, notes,
    total_time_spent_seconds, audio_recordings_count, latest_transcript
FROM leads
WHERE is_deleted = TRUE OR (archived_at IS NOT NULL AND archived_at != '');

-- View C: All Event Logs with Live Attendee Status (Preserved logs for ALL leads)
CREATE OR REPLACE VIEW view_all_event_logs AS
SELECT 
    a.activity_id,
    a.activity_at,
    a.activity_type,
    a.owner AS staff_owner,
    COALESCE(l.full_name, a.lead_id) AS attendee_name,
    COALESCE(l.organisation, '—') AS organisation,
    CASE 
        WHEN l.is_deleted = TRUE OR (l.archived_at IS NOT NULL AND l.archived_at != '') THEN 'Archived / Deleted'
        WHEN l.lead_id IS NULL THEN 'Unlinked'
        ELSE 'Active'
    END AS attendee_status,
    a.summary,
    a.outcome,
    a.transcript,
    a.duration_seconds
FROM activities a
LEFT JOIN leads l ON a.lead_id = l.lead_id
ORDER BY a.activity_at DESC;
"""

def init_postgres_schema(data_dir):
    conn = get_connection(data_dir)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(SCHEMA_SQL)
        cur.close()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Failed to execute schema SQL: {e}")
        try: conn.close()
        except: pass
        raise

def sync_all_to_postgres(data_dir):
    """
    Synchronizes all records (leads, activities, recordings, transcripts)
    from local JSON and Excel files into PostgreSQL.
    Guarantees soft-deletes (no data dropped).
    """
    if not PSYCOPG2_AVAILABLE:
        return {"success": False, "error": "psycopg2-binary not installed"}

    test_res = test_connection(data_dir)
    if not test_res.get("connected"):
        return {"success": False, "error": test_res.get("error", "Cannot connect to PostgreSQL")}

    init_postgres_schema(data_dir)
    conn = get_connection(data_dir)

    leads_path = os.path.join(data_dir, "leads.json")
    activities_path = os.path.join(data_dir, "activities.json")
    recordings_path = os.path.join(data_dir, "recordings.json")
    transcripts_dir = os.path.join(data_dir, "transcripts")

    leads = []
    if os.path.exists(leads_path):
        try:
            with open(leads_path, "r", encoding="utf-8") as f:
                leads = json.load(f)
        except Exception:
            leads = []

    activities = []
    if os.path.exists(activities_path):
        try:
            with open(activities_path, "r", encoding="utf-8") as f:
                activities = json.load(f)
        except Exception:
            activities = []

    recordings = []
    if os.path.exists(recordings_path):
        try:
            with open(recordings_path, "r", encoding="utf-8") as f:
                recordings = json.load(f)
        except Exception:
            recordings = []

    counts = {"leads": 0, "activities": 0, "recordings": 0, "transcripts": 0}

    try:
        conn.autocommit = False
        cur = conn.cursor()

        # 1. Sync Leads (Upsert)
        lead_upsert = """
        INSERT INTO leads (
            lead_id, created_at, updated_at, full_name, job_title, email, phone,
            preferred_contact_method, country, preferred_language, organisation,
            organisation_type, organisation_website, organisation_location, organisation_size,
            incubation_interest, idea_title, primary_sector, idea_pitch, incubation_support,
            ip_status, sectors, source, interaction_date, event_tracks, collaboration_interests,
            problem_or_need, capability_offered, readiness_level, estimated_value, currency,
            priority, stage, stage_changed_at, owner, next_action, follow_up_date,
            follow_up_outcome, closed_reason, conversion_date, consent, consent_at,
            consent_method, consent_notes, notes, archived_at, is_deleted,
            total_time_spent_seconds, audio_recordings_count, latest_transcript, synced_at
        ) VALUES (
            %(lead_id)s, %(created_at)s, %(updated_at)s, %(full_name)s, %(job_title)s, %(email)s, %(phone)s,
            %(preferred_contact_method)s, %(country)s, %(preferred_language)s, %(organisation)s,
            %(organisation_type)s, %(organisation_website)s, %(organisation_location)s, %(organisation_size)s,
            %(incubation_interest)s, %(idea_title)s, %(primary_sector)s, %(idea_pitch)s, %(incubation_support)s,
            %(ip_status)s, %(sectors)s, %(source)s, %(interaction_date)s, %(event_tracks)s, %(collaboration_interests)s,
            %(problem_or_need)s, %(capability_offered)s, %(readiness_level)s, %(estimated_value)s, %(currency)s,
            %(priority)s, %(stage)s, %(stage_changed_at)s, %(owner)s, %(next_action)s, %(follow_up_date)s,
            %(follow_up_outcome)s, %(closed_reason)s, %(conversion_date)s, %(consent)s, %(consent_at)s,
            %(consent_method)s, %(consent_notes)s, %(notes)s, %(archived_at)s, %(is_deleted)s,
            %(total_time_spent_seconds)s, %(audio_recordings_count)s, %(latest_transcript)s, CURRENT_TIMESTAMP
        )
        ON CONFLICT (lead_id) DO UPDATE SET
            updated_at = EXCLUDED.updated_at,
            full_name = EXCLUDED.full_name,
            job_title = EXCLUDED.job_title,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            preferred_contact_method = EXCLUDED.preferred_contact_method,
            country = EXCLUDED.country,
            organisation = EXCLUDED.organisation,
            organisation_type = EXCLUDED.organisation_type,
            organisation_website = EXCLUDED.organisation_website,
            organisation_location = EXCLUDED.organisation_location,
            incubation_interest = EXCLUDED.incubation_interest,
            idea_title = EXCLUDED.idea_title,
            primary_sector = EXCLUDED.primary_sector,
            idea_pitch = EXCLUDED.idea_pitch,
            incubation_support = EXCLUDED.incubation_support,
            ip_status = EXCLUDED.ip_status,
            sectors = EXCLUDED.sectors,
            priority = EXCLUDED.priority,
            stage = EXCLUDED.stage,
            owner = EXCLUDED.owner,
            next_action = EXCLUDED.next_action,
            follow_up_date = EXCLUDED.follow_up_date,
            follow_up_outcome = EXCLUDED.follow_up_outcome,
            closed_reason = EXCLUDED.closed_reason,
            consent = EXCLUDED.consent,
            notes = EXCLUDED.notes,
            archived_at = EXCLUDED.archived_at,
            is_deleted = EXCLUDED.is_deleted,
            total_time_spent_seconds = EXCLUDED.total_time_spent_seconds,
            audio_recordings_count = EXCLUDED.audio_recordings_count,
            latest_transcript = EXCLUDED.latest_transcript,
            synced_at = CURRENT_TIMESTAMP;
        """

        for l in leads:
            is_del = bool(l.get("archivedAt") or l.get("isDeleted"))
            archived_val = l.get("archivedAt") or ("2026-10-24T00:00:00Z" if is_del else None)
            
            support_str = "; ".join(l["incubationSupport"]) if isinstance(l.get("incubationSupport"), list) else (l.get("incubationSupport") or "")
            sectors_str = "; ".join(l["sectors"]) if isinstance(l.get("sectors"), list) else (l.get("sectors") or "")
            tracks_str = "; ".join(l["eventTracks"]) if isinstance(l.get("eventTracks"), list) else (l.get("eventTracks") or "")
            interests_str = "; ".join(l["collaborationInterests"]) if isinstance(l.get("collaborationInterests"), list) else (l.get("collaborationInterests") or "")

            est_val = None
            if l.get("estimatedValue") is not None and str(l.get("estimatedValue")).strip():
                try: est_val = float(l.get("estimatedValue"))
                except: pass

            row_data = {
                "lead_id": l.get("leadId"),
                "created_at": l.get("createdAt"),
                "updated_at": l.get("updatedAt"),
                "full_name": l.get("fullName") or "Attendee",
                "job_title": l.get("jobTitle") or "",
                "email": l.get("email") or "",
                "phone": str(l.get("phone") or ""),
                "preferred_contact_method": l.get("preferredContactMethod") or "Email",
                "country": l.get("country") or "India",
                "preferred_language": l.get("preferredLanguage") or "",
                "organisation": l.get("organisation") or "",
                "organisation_type": l.get("organisationType") or "Other",
                "organisation_website": l.get("organisationWebsite") or "",
                "organisation_location": l.get("organisationLocation") or "",
                "organisation_size": l.get("organisationSize") or "",
                "incubation_interest": l.get("incubationInterest") or "",
                "idea_title": l.get("ideaTitle") or "",
                "primary_sector": l.get("primarySector") or "",
                "idea_pitch": l.get("ideaPitch") or "",
                "incubation_support": support_str,
                "ip_status": l.get("ipStatus") or "",
                "sectors": sectors_str,
                "source": l.get("source") or "ETM 2026 – in person",
                "interaction_date": l.get("interactionDate") or "",
                "event_tracks": tracks_str,
                "collaboration_interests": interests_str,
                "problem_or_need": l.get("problemOrNeed") or "",
                "capability_offered": l.get("capabilityOffered") or "",
                "readiness_level": l.get("readinessLevel") or "",
                "estimated_value": est_val,
                "currency": l.get("currency") or "INR (₹)",
                "priority": l.get("priority") or "Normal",
                "stage": l.get("stage") or "New",
                "stage_changed_at": l.get("stageChangedAt") or "",
                "owner": l.get("owner") or "",
                "next_action": l.get("nextAction") or "",
                "follow_up_date": l.get("followUpDate") or "",
                "follow_up_outcome": l.get("followUpOutcome") or "",
                "closed_reason": l.get("closedReason") or "",
                "conversion_date": l.get("conversionDate") or "",
                "consent": l.get("consent") or "No",
                "consent_at": l.get("consentAt") or "",
                "consent_method": l.get("consentMethod") or "",
                "consent_notes": l.get("consentNotes") or "",
                "notes": l.get("notes") or "",
                "archived_at": archived_val,
                "is_deleted": is_del,
                "total_time_spent_seconds": int(l.get("totalTimeSpentSeconds") or 0),
                "audio_recordings_count": int(l.get("audioRecordingsCount") or 0),
                "latest_transcript": l.get("latestTranscript") or ""
            }
            cur.execute(lead_upsert, row_data)
            counts["leads"] += 1

        # 2. Sync Activities (Preserved logs - Upsert)
        activity_upsert = """
        INSERT INTO activities (
            activity_id, lead_id, activity_type, activity_at, owner, summary,
            outcome, transcript, recording_id, duration_seconds, audio_relative_path,
            vtt_relative_path, is_archived_lead, synced_at
        ) VALUES (
            %(activity_id)s, %(lead_id)s, %(activity_type)s, %(activity_at)s, %(owner)s, %(summary)s,
            %(outcome)s, %(transcript)s, %(recording_id)s, %(duration_seconds)s, %(audio_relative_path)s,
            %(vtt_relative_path)s, %(is_archived_lead)s, CURRENT_TIMESTAMP
        )
        ON CONFLICT (activity_id) DO UPDATE SET
            owner = EXCLUDED.owner,
            summary = EXCLUDED.summary,
            outcome = EXCLUDED.outcome,
            transcript = EXCLUDED.transcript,
            duration_seconds = EXCLUDED.duration_seconds,
            is_archived_lead = EXCLUDED.is_archived_lead,
            synced_at = CURRENT_TIMESTAMP;
        """

        leads_archived_map = {l.get("leadId"): bool(l.get("archivedAt") or l.get("isDeleted")) for l in leads}

        for a in activities:
            act_id = a.get("activityId") or a.get("id")
            if not act_id:
                continue
            lid = a.get("leadId")
            dur = None
            if a.get("durationSeconds") is not None:
                try: dur = float(a.get("durationSeconds"))
                except: pass

            row_act = {
                "activity_id": act_id,
                "lead_id": lid,
                "activity_type": a.get("activityType") or "Note",
                "activity_at": a.get("activityAt") or a.get("timestamp") or "",
                "owner": a.get("owner") or "Staff",
                "summary": a.get("summary") or "",
                "outcome": a.get("outcome") or "",
                "transcript": a.get("transcript") or "",
                "recording_id": a.get("recordingId") or "",
                "duration_seconds": dur,
                "audio_relative_path": a.get("audioRelativePath") or "",
                "vtt_relative_path": a.get("vttRelativePath") or "",
                "is_archived_lead": leads_archived_map.get(lid, False)
            }
            cur.execute(activity_upsert, row_act)
            counts["activities"] += 1

        # 3. Sync Recordings
        rec_upsert = """
        INSERT INTO recordings (
            recording_id, lead_id, created_at, created_by, duration_seconds,
            audio_size_bytes, audio_relative_path, audio_checksum, transcription_status,
            whishper_job_id, transcript_relative_path, language, completed_at,
            transcript_preview, error_message, edited_transcript_at, synced_at
        ) VALUES (
            %(recording_id)s, %(lead_id)s, %(created_at)s, %(created_by)s, %(duration_seconds)s,
            %(audio_size_bytes)s, %(audio_relative_path)s, %(audio_checksum)s, %(transcription_status)s,
            %(whishper_job_id)s, %(transcript_relative_path)s, %(language)s, %(completed_at)s,
            %(transcript_preview)s, %(error_message)s, %(edited_transcript_at)s, CURRENT_TIMESTAMP
        )
        ON CONFLICT (recording_id) DO UPDATE SET
            transcription_status = EXCLUDED.transcription_status,
            completed_at = EXCLUDED.completed_at,
            transcript_preview = EXCLUDED.transcript_preview,
            edited_transcript_at = EXCLUDED.edited_transcript_at,
            synced_at = CURRENT_TIMESTAMP;
        """

        for r in recordings:
            rec_id = r.get("recordingId")
            if not rec_id:
                continue
            dur = None
            if r.get("durationSeconds") is not None:
                try: dur = float(r.get("durationSeconds"))
                except: pass
            size_b = None
            if r.get("audioSizeBytes") is not None:
                try: size_b = int(r.get("audioSizeBytes"))
                except: pass

            row_rec = {
                "recording_id": rec_id,
                "lead_id": r.get("leadId") or "",
                "created_at": r.get("createdAt") or "",
                "created_by": r.get("createdBy") or "Staff",
                "duration_seconds": dur,
                "audio_size_bytes": size_b,
                "audio_relative_path": r.get("audioRelativePath") or "",
                "audio_checksum": r.get("audioChecksum") or "",
                "transcription_status": r.get("transcriptionStatus") or "pending",
                "whishper_job_id": r.get("whishperJobId") or "",
                "transcript_relative_path": r.get("transcriptRelativePath") or "",
                "language": r.get("language") or "auto",
                "completed_at": r.get("completedAt") or "",
                "transcript_preview": r.get("transcriptPreview") or (r.get("fullText", "")[:120]),
                "error_message": r.get("errorMessage") or "",
                "edited_transcript_at": r.get("editedTranscriptAt") or ""
            }
            cur.execute(rec_upsert, row_rec)
            counts["recordings"] += 1

            # Check for transcript on disk
            full_txt = r.get("fullText") or ""
            edited_txt = r.get("editedText") or ""
            if not full_txt and r.get("transcriptRelativePath"):
                abs_t = os.path.join(data_dir, r.get("transcriptRelativePath"))
                if os.path.exists(abs_t):
                    try:
                        with open(abs_t, "r", encoding="utf-8") as tf:
                            tobj = json.load(tf)
                            full_txt = tobj.get("fullText") or ""
                            edited_txt = tobj.get("editedText") or ""
                    except Exception:
                        pass

            if full_txt or edited_txt:
                cur.execute("""
                    INSERT INTO transcripts (recording_id, lead_id, full_text, edited_text, status, language, created_at, completed_at, synced_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (recording_id) DO UPDATE SET
                        full_text = EXCLUDED.full_text,
                        edited_text = EXCLUDED.edited_text,
                        status = EXCLUDED.status,
                        synced_at = CURRENT_TIMESTAMP;
                """, (rec_id, r.get("leadId"), full_txt, edited_txt, r.get("transcriptionStatus"), r.get("language"), r.get("createdAt"), r.get("completedAt")))
                counts["transcripts"] += 1

        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "counts": counts, "timestamp": datetime.now().isoformat()}

    except Exception as e:
        conn.rollback()
        try: conn.close()
        except: pass
        logger.error(f"Error during postgres sync: {e}")
        return {"success": False, "error": str(e)}

def get_postgres_stats(data_dir):
    test_res = test_connection(data_dir)
    if not test_res.get("connected"):
        return {"connected": False, "error": test_res.get("error")}

    try:
        conn = get_connection(data_dir, timeout=2)
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM leads WHERE is_deleted = FALSE AND (archived_at IS NULL OR archived_at = '');")
        active_leads = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM leads WHERE is_deleted = TRUE OR (archived_at IS NOT NULL AND archived_at != '');")
        archived_leads = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM activities;")
        activities = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM recordings;")
        recordings = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM transcripts;")
        transcripts = cur.fetchone()[0]

        cur.close()
        conn.close()

        return {
            "connected": True,
            "stats": {
                "active_leads": active_leads,
                "archived_leads": archived_leads,
                "total_leads": active_leads + archived_leads,
                "activities": activities,
                "recordings": recordings,
                "transcripts": transcripts
            },
            "server": test_res
        }
    except Exception as e:
        return {"connected": True, "stats": None, "error": str(e), "server": test_res}
