/**
 * Anna Incubator ETM 2026 Lead CRM - Local & Remote Storage Management
 * Handles localStorage persistence, server mirroring (/api/leads, /api/activities),
 * JSON backups, audit logging, and conflict mitigation.
 */

const CRM_Storage = (function() {
  const LEADS_KEY = 'anna_etm_leads_v2';
  const ACTIVITIES_KEY = 'anna_etm_activities_v2';
  const AUDIT_KEY = 'anna_etm_audit_log_v2';
  const SETTINGS_KEY = 'anna_etm_settings_v2';
  const LAST_SYNC_KEY = 'anna_etm_last_sync_v2';

  let leads = [];
  let activities = [];
  let auditLogs = [];
  let syncStatus = {
    connected: false,
    lastSuccessfulSync: localStorage.getItem(LAST_SYNC_KEY) || null,
    serverType: 'Local Browser (Standalone)',
    message: 'Initializing...'
  };

  let listeners = [];
  let serverSyncTimer = null;

  function init() {
    try {
      const storedLeads = localStorage.getItem(LEADS_KEY);
      if (storedLeads) {
        leads = JSON.parse(storedLeads);
      } else {
        leads = [...INITIAL_SEED_LEADS];
        localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
      }

      const storedActivities = localStorage.getItem(ACTIVITIES_KEY);
      if (storedActivities) {
        activities = JSON.parse(storedActivities);
      } else {
        activities = [...INITIAL_SEED_ACTIVITIES];
        localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
      }

      const storedAudit = localStorage.getItem(AUDIT_KEY);
      if (storedAudit) {
        auditLogs = JSON.parse(storedAudit);
      } else {
        auditLogs = [{
          timestamp: new Date().toISOString(),
          action: 'INIT',
          details: 'Initialized Anna Incubator ETM 2026 CRM with standard dataset.'
        }];
        localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLogs));
      }
    } catch (e) {
      console.error('Storage initialization error:', e);
      leads = [...INITIAL_SEED_LEADS];
      activities = [...INITIAL_SEED_ACTIVITIES];
    }

    // Attempt remote sync if server running
    syncRemote();
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach(fn => {
      try { fn({ leads, activities, auditLogs, syncStatus }); } catch (e) { console.error(e); }
    });
  }

  function persistLocal() {
    try {
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
      localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLogs));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
    notify();
    debouncedRemoteSync();
  }

  function logAudit(action, details) {
    const entry = {
      id: 'AUD-' + Date.now(),
      timestamp: new Date().toISOString(),
      action,
      details
    };
    auditLogs.unshift(entry);
    if (auditLogs.length > 500) auditLogs.pop();
    try {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLogs));
    } catch (e) {}
  }

  async function syncRemote() {
    try {
      const statusRes = await fetch('/api/status', { cache: 'no-store' });
      if (statusRes.ok) {
        const info = await statusRes.json();
        syncStatus.connected = true;
        syncStatus.serverType = info.server || 'Local Disk Server';

        // Check if server has leads
        const leadsRes = await fetch('/api/leads', { cache: 'no-store' });
        if (leadsRes.ok) {
          const data = await leadsRes.json();
          if (Array.isArray(data.leads) && data.leads.length > 0) {
            // Merge remote leads with local leads
            mergeLeads(data.leads, false);
          } else {
            // Push local leads to server
            await pushToServer();
          }
        }

        // Check activities
        const actRes = await fetch('/api/activities', { cache: 'no-store' });
        if (actRes.ok) {
          const actData = await actRes.json();
          if (Array.isArray(actData.activities) && actData.activities.length > 0) {
            mergeActivities(actData.activities, false);
          }
        }

        const now = new Date().toISOString();
        syncStatus.lastSuccessfulSync = now;
        localStorage.setItem(LAST_SYNC_KEY, now);
        syncStatus.message = 'Synced with disk (data/leads.json)';
      } else {
        syncStatus.connected = false;
        syncStatus.message = 'Browser storage active (offline / standalone)';
      }
    } catch (e) {
      syncStatus.connected = false;
      syncStatus.message = 'Browser storage active (offline / standalone)';
    }
    notify();
  }

  async function pushToServer() {
    if (!syncStatus.connected) return;
    try {
      await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads)
      });
      await fetch('/api/activities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activities)
      });
      const now = new Date().toISOString();
      syncStatus.lastSuccessfulSync = now;
      localStorage.setItem(LAST_SYNC_KEY, now);
      syncStatus.message = 'Synced with disk (data/leads.json)';
      notify();
    } catch (e) {
      console.warn('Could not mirror data to server:', e);
    }
  }

  function debouncedRemoteSync() {
    clearTimeout(serverSyncTimer);
    serverSyncTimer = setTimeout(() => {
      pushToServer();
    }, 500);
  }

  function getLeads() {
    return leads.filter(l => !l.archivedAt && !l.isDeleted);
  }

  function getAllLeadsIncludingArchived() {
    return [...leads];
  }

  function getLeadById(id) {
    return leads.find(l => l.leadId === id) || null;
  }

  function saveLead(leadData, isNew = false) {
    const now = new Date().toISOString();
    const existingIndex = leads.findIndex(l => l.leadId === leadData.leadId);

    if (existingIndex >= 0) {
      const prev = leads[existingIndex];
      const updated = {
        ...prev,
        ...leadData,
        phone: (leadData.phone && String(leadData.phone).trim()) || prev.phone || '',
        updatedAt: now
      };

      // Check for stage change to log activity
      if (prev.stage !== updated.stage) {
        updated.stageChangedAt = now;
        if (['Converted', 'Closed – successful'].includes(updated.stage) && !updated.conversionDate) {
          updated.conversionDate = now;
        }
        addActivity({
          leadId: updated.leadId,
          activityType: 'Stage change',
          owner: updated.owner || 'Staff',
          summary: `Stage updated from "${prev.stage}" to "${updated.stage}".`,
          outcome: updated.followUpOutcome || '',
          nextAction: updated.nextAction || '',
          followUpDate: updated.followUpDate || ''
        });
      }

      // Check for consent change
      if (prev.consent !== updated.consent) {
        if (updated.consent === 'Yes') {
          updated.consentAt = now;
        }
        addActivity({
          leadId: updated.leadId,
          activityType: 'Consent update',
          owner: updated.owner || 'Staff',
          summary: `Consent status changed to "${updated.consent}" via ${updated.consentMethod || 'in-person'}.`,
          outcome: '',
          nextAction: updated.nextAction || '',
          followUpDate: updated.followUpDate || ''
        });
      }

      leads[existingIndex] = updated;
      logAudit('UPDATE_LEAD', `Updated contact: ${updated.fullName} (${updated.organisation}) [${updated.leadId}]`);
      persistLocal();
      pushToServer();
      return updated;
    } else {
      const newLead = {
        ...leadData,
        leadId: leadData.leadId || generateLeadId(),
        createdAt: leadData.createdAt || now,
        updatedAt: now,
        stageChangedAt: leadData.stageChangedAt || now,
        consentAt: leadData.consent === 'Yes' ? (leadData.consentAt || now) : '',
        archivedAt: ''
      };

      if (['Converted', 'Closed – successful'].includes(newLead.stage) && !newLead.conversionDate) {
        newLead.conversionDate = now;
      }

      leads.unshift(newLead);
      logAudit('CREATE_LEAD', `Created new contact: ${newLead.fullName} (${newLead.organisation}) [${newLead.leadId}]`);

      // Automatic in-person meeting interaction log
      const ideaDetail = newLead.ideaTitle ? ` Innovation Pitch: "${newLead.ideaTitle}" (${newLead.primarySector || 'Energy / DeepTech'}).` : '';
      const incDetail = newLead.incubationInterest ? ` Cohort / Incubation Intent: ${newLead.incubationInterest}.` : '';

      addActivity({
        leadId: newLead.leadId,
        activityType: 'Meeting',
        owner: newLead.owner || 'Staff',
        summary: `In-person event desk interaction at ETM 2026 (Stall A-14 & DeepTech Lounge, Grand Hyatt Goa).${ideaDetail}${incDetail}`,
        outcome: newLead.followUpOutcome || `Captured attendee requirements via ${newLead.source || 'ETM 2026 – in person'}. Interaction date auto-logged: ${newLead.interactionDate || now.slice(0, 10)}.`,
        nextAction: newLead.nextAction || 'Review incubation readiness & follow-up',
        followUpDate: newLead.followUpDate || ''
      });

      persistLocal();
      pushToServer();
      return newLead;
    }
  }

  function deleteLead(id, permanent = false) {
    const lead = getLeadById(id);
    if (!lead) return false;

    // Strict Zero Data Loss Policy:
    // Lead is NEVER physically deleted from storage, Excel, or PostgreSQL pgAdmin.
    // Setting isDeleted = true and archivedAt removes lead from active dashboard data,
    // while keeping all event logs, transcripts, and database history permanently preserved.
    const nowIso = new Date().toISOString();
    lead.isDeleted = true;
    lead.archivedAt = lead.archivedAt || nowIso;
    lead.deletedAt = nowIso;

    logAudit('ARCHIVE_LEAD', `Removed lead from dashboard (logs preserved): ${lead.fullName} (${lead.organisation}) [${id}]`);
    persistLocal();
    
    // Notify server of soft delete so disk JSON, Excel DB, and PostgreSQL pgAdmin reflect is_deleted=TRUE
    fetch(`/api/leads/${id}`, { method: 'DELETE' }).catch(() => {});
    return true;
  }

  function getActivities(leadId = null) {
    if (!leadId) {
      return [...activities].sort((a, b) => (b.activityAt || '').localeCompare(a.activityAt || ''));
    }
    return activities
      .filter(a => a.leadId === leadId)
      .sort((a, b) => (b.activityAt || '').localeCompare(a.activityAt || ''));
  }

  function addActivity(activityData) {
    const now = new Date().toISOString();
    const newAct = {
      activityId: activityData.activityId || generateActivityId(),
      leadId: activityData.leadId,
      activityType: activityData.activityType || 'Note',
      activityAt: activityData.activityAt || now,
      owner: activityData.owner || 'Staff',
      summary: activityData.summary || '',
      outcome: activityData.outcome || '',
      nextAction: activityData.nextAction || '',
      followUpDate: activityData.followUpDate || '',
      transcript: activityData.transcript || '',
      recordingId: activityData.recordingId || '',
      durationSeconds: activityData.durationSeconds || 0,
      audioRelativePath: activityData.audioRelativePath || '',
      vttRelativePath: activityData.vttRelativePath || ''
    };

    activities.unshift(newAct);

    // If activity provides nextAction or followUpDate or transcript, update the parent lead
    if (newAct.leadId) {
      const lead = leads.find(l => l.leadId === newAct.leadId);
      if (lead) {
        if (newAct.nextAction) lead.nextAction = newAct.nextAction;
        if (newAct.followUpDate) lead.followUpDate = newAct.followUpDate;
        if (newAct.outcome) lead.followUpOutcome = newAct.outcome;
        if (newAct.transcript) {
          lead.latestTranscript = newAct.transcript;
          lead.audioRecordingsCount = (lead.audioRecordingsCount || 0) + 1;
        }
        lead.updatedAt = now;
      }
    }

    logAudit('LOG_ACTIVITY', `Logged ${newAct.activityType} for lead [${newAct.leadId}]: ${newAct.summary.slice(0, 40)}...`);
    persistLocal();
    return newAct;
  }

  function updateLeadTranscript(leadId, transcript, recordingId = '') {
    const lead = getLeadById(leadId);
    if (!lead) return false;
    const now = new Date().toISOString();
    lead.latestTranscript = transcript;
    lead.updatedAt = now;
    if (transcript && (!lead.notes || !lead.notes.includes(transcript))) {
      lead.notes = `${lead.notes ? lead.notes + '\n' : ''}[Transcribed Dialogue ${now.slice(0, 10)}]: ${transcript}`.trim();
    }
    persistLocal();
    return true;
  }

  function mergeLeads(incomingLeads, updateStorage = true) {
    let inserted = 0;
    let updated = 0;
    const now = new Date().toISOString();

    incomingLeads.forEach(incoming => {
      const normalizedEmail = (incoming.email || '').trim().toLowerCase();
      const existing = leads.find(l =>
        l.leadId === incoming.leadId ||
        (normalizedEmail && (l.email || '').trim().toLowerCase() === normalizedEmail)
      );

      if (existing) {
        // Compare updatedAt timestamp: latest wins or incoming updates fields
        const incomingTime = incoming.updatedAt || '';
        const existingTime = existing.updatedAt || '';

        const merged = {
          ...existing,
          ...incoming,
          leadId: existing.leadId,
          createdAt: existing.createdAt || incoming.createdAt,
          updatedAt: incomingTime > existingTime ? incomingTime : existingTime || now
        };

        const idx = leads.findIndex(l => l.leadId === existing.leadId);
        leads[idx] = merged;
        updated++;
      } else {
        const fresh = {
          ...incoming,
          leadId: incoming.leadId || generateLeadId(),
          createdAt: incoming.createdAt || now,
          updatedAt: incoming.updatedAt || now
        };
        leads.push(fresh);
        inserted++;
      }
    });

    logAudit('IMPORT_MERGE', `Merged ${incomingLeads.length} leads: ${inserted} new inserted, ${updated} existing updated.`);
    if (updateStorage) {
      persistLocal();
    }
    return { inserted, updated, total: incomingLeads.length };
  }

  function mergeActivities(incomingActivities, updateStorage = true) {
    let added = 0;
    incomingActivities.forEach(incoming => {
      if (!activities.some(a => a.activityId === incoming.activityId)) {
        activities.push(incoming);
        added++;
      }
    });
    if (updateStorage && added > 0) {
      persistLocal();
    }
    return added;
  }

  function backupJson() {
    const backupData = {
      exportTime: new Date().toISOString(),
      crmVersion: 'ETM-2026-v2.0',
      event: '29th Energy Technology & Innovation Meet (ETM 2026) - Goa',
      stats: {
        totalLeads: leads.length,
        totalActivities: activities.length
      },
      leads,
      activities,
      users: CRM_CONSTANTS.USERS,
      auditLogs
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `anna-incubator-etm2026-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logAudit('BACKUP_JSON', `Downloaded JSON full backup snapshot (${leads.length} leads, ${activities.length} activities).`);
  }

  function restoreJson(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data.leads)) {
        throw new Error('Invalid backup file: missing leads array.');
      }

      // Keep pre-restore backup in memory/storage
      const preRestore = JSON.stringify({ leads, activities, timestamp: new Date().toISOString() });
      localStorage.setItem('anna_etm_pre_restore_bak', preRestore);

      leads = data.leads;
      activities = Array.isArray(data.activities) ? data.activities : [];
      if (Array.isArray(data.auditLogs)) {
        auditLogs = data.auditLogs;
      }

      logAudit('RESTORE_JSON', `Restored database from JSON snapshot: ${leads.length} leads, ${activities.length} activities.`);
      persistLocal();
      return { success: true, leadsCount: leads.length, activitiesCount: activities.length };
    } catch (e) {
      console.error('Restore failed:', e);
      return { success: false, error: e.message };
    }
  }

  function getSyncStatus() {
    return { ...syncStatus };
  }

  function getAuditLog() {
    return [...auditLogs];
  }

  return {
    init,
    subscribe,
    getLeads,
    getAllLeadsIncludingArchived,
    getLeadById,
    saveLead,
    deleteLead,
    getActivities,
    addActivity,
    mergeLeads,
    mergeActivities,
    backupJson,
    restoreJson,
    getSyncStatus,
    getAuditLog,
    syncRemote,
    pushToServer,
    updateLeadTranscript
  };
})();
