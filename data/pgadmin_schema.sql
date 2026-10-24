-- =============================================================================
-- Anna Incubator ETM 2026 Lead CRM - pgAdmin Master Relational Schema
-- Execute in pgAdmin 4 (Query Tool) connected to PostgreSQL 18
-- Database: anna_etm_db (or postgres)
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

-- 4. Complete Audio Transcripts Table
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
