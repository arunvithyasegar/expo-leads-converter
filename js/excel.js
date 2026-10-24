/**
 * Anna Incubator ETM 2026 Lead CRM - Excel (.xlsx) & CSV Engine
 * Provides multi-sheet workbook generation (Leads, Activities, Lists, Users),
 * column mapping, import validation, and conflict preview.
 */

const CRM_Excel = (function() {

  /**
   * Converts a lead object into an Excel row object matching EXCEL_COLUMNS
   */
  function leadToRow(lead) {
    return {
      'LeadID': lead.leadId || '',
      'CreatedAt': lead.createdAt || '',
      'UpdatedAt': lead.updatedAt || '',
      'FullName': lead.fullName || '',
      'JobTitle': lead.jobTitle || '',
      'Email': lead.email || '',
      'Phone': lead.phone || '',
      'PreferredContactMethod': lead.preferredContactMethod || 'Email',
      'Country': lead.country || 'India',
      'PreferredLanguage': lead.preferredLanguage || '',
      'Organisation': lead.organisation || '',
      'OrganisationType': lead.organisationType || 'Other',
      'OrganisationWebsite': lead.organisationWebsite || '',
      'OrganisationLocation': lead.organisationLocation || '',
      'OrganisationSize': lead.organisationSize || '',
      'IncubationInterest': lead.incubationInterest || '',
      'IdeaTitle': lead.ideaTitle || '',
      'PrimarySector': lead.primarySector || '',
      'IdeaPitch': lead.ideaPitch || '',
      'IncubationSupport': Array.isArray(lead.incubationSupport) ? lead.incubationSupport.join('; ') : (lead.incubationSupport || ''),
      'IPStatus': lead.ipStatus || '',
      'Sectors': Array.isArray(lead.sectors) ? lead.sectors.join('; ') : (lead.sectors || ''),
      'Source': lead.source || 'ETM 2026 – in person',
      'InteractionDate': lead.interactionDate || '',
      'EventTracks': Array.isArray(lead.eventTracks) ? lead.eventTracks.join('; ') : (lead.eventTracks || ''),
      'CollaborationInterests': Array.isArray(lead.collaborationInterests) ? lead.collaborationInterests.join('; ') : (lead.collaborationInterests || ''),
      'ProblemOrNeed': lead.problemOrNeed || '',
      'CapabilityOffered': lead.capabilityOffered || '',
      'ReadinessLevel': lead.readinessLevel || '',
      'EstimatedValue': lead.estimatedValue != null ? lead.estimatedValue : '',
      'Currency': lead.currency || 'INR (₹)',
      'Priority': lead.priority || 'Normal',
      'Stage': lead.stage || 'New',
      'StageChangedAt': lead.stageChangedAt || '',
      'Owner': lead.owner || '',
      'NextAction': lead.nextAction || '',
      'FollowUpDate': lead.followUpDate || '',
      'FollowUpOutcome': lead.followUpOutcome || '',
      'ClosedReason': lead.closedReason || '',
      'ConversionDate': lead.conversionDate || '',
      'Consent': lead.consent || 'No',
      'ConsentAt': lead.consentAt || '',
      'ConsentMethod': lead.consentMethod || '',
      'ConsentNotes': lead.consentNotes || '',
      'Notes': lead.notes || '',
      'ArchivedAt': lead.archivedAt || '',
      'TotalTimeSpentSeconds': lead.totalTimeSpentSeconds != null ? lead.totalTimeSpentSeconds : 0,
      'TotalTimeSpentFormatted': (window.CRM_UI && CRM_UI.formatDuration) ? CRM_UI.formatDuration(lead.totalTimeSpentSeconds || 0) : `${Math.floor((lead.totalTimeSpentSeconds || 0) / 60)}m ${((lead.totalTimeSpentSeconds || 0) % 60)}s`,
      'AudioRecordingsCount': lead.audioRecordingsCount != null ? lead.audioRecordingsCount : '',
      'LatestAudioTranscript': lead.latestAudioTranscript || ''
    };
  }

  /**
   * Converts an activity object into an Excel row object
   */
  function activityToRow(act) {
    return {
      'ActivityID': act.activityId || '',
      'LeadID': act.leadId || '',
      'ActivityType': act.activityType || 'Note',
      'ActivityAt': act.activityAt || '',
      'Owner': act.owner || '',
      'Summary': act.summary || '',
      'Outcome': act.outcome || '',
      'NextAction': act.nextAction || '',
      'FollowUpDate': act.followUpDate || ''
    };
  }

  /**
   * Builds the controlled Lists reference sheet
   */
  function buildListsSheet() {
    const maxLen = Math.max(
      CRM_CONSTANTS.ORGANISATION_TYPES.length,
      CRM_CONSTANTS.STAGES.length,
      CRM_CONSTANTS.SECTORS.length,
      CRM_CONSTANTS.EVENT_TRACKS.length,
      CRM_CONSTANTS.COLLABORATION_INTERESTS.length,
      CRM_CONSTANTS.SOURCES.length,
      CRM_CONSTANTS.PRIORITIES.length,
      CRM_CONSTANTS.CONSENT_OPTIONS.length,
      CRM_CONSTANTS.CONTACT_METHODS.length,
      CRM_CONSTANTS.CLOSED_REASONS.length
    );

    const rows = [];
    // Header row
    rows.push([
      'OrganisationTypes',
      'Stages',
      'Sectors',
      'EventTracks',
      'CollaborationInterests',
      'LeadSources',
      'Priorities',
      'ConsentOptions',
      'ContactMethods',
      'ClosedReasons'
    ]);

    for (let i = 0; i < maxLen; i++) {
      rows.push([
        CRM_CONSTANTS.ORGANISATION_TYPES[i] || '',
        CRM_CONSTANTS.STAGES[i] || '',
        CRM_CONSTANTS.SECTORS[i] || '',
        CRM_CONSTANTS.EVENT_TRACKS[i] || '',
        CRM_CONSTANTS.COLLABORATION_INTERESTS[i] || '',
        CRM_CONSTANTS.SOURCES[i] || '',
        CRM_CONSTANTS.PRIORITIES[i] || '',
        CRM_CONSTANTS.CONSENT_OPTIONS[i] || '',
        CRM_CONSTANTS.CONTACT_METHODS[i] || '',
        CRM_CONSTANTS.CLOSED_REASONS[i] || ''
      ]);
    }

    return XLSX.utils.aoa_to_sheet(rows);
  }

  /**
   * Generates a 5-sheet .xlsx workbook (Leads, Activities, Lists, Users, Recordings)
   */
  function createWorkbook(leadsToExport, activitiesToExport, recordingsToExport = []) {
    if (!window.XLSX) {
      throw new Error('SheetJS library is not available.');
    }

    const wb = XLSX.utils.book_new();

    // 1. Leads Sheet
    const leadsData = leadsToExport.map(leadToRow);
    const leadsWs = XLSX.utils.json_to_sheet(leadsData, { header: CRM_CONSTANTS.EXCEL_COLUMNS });
    leadsWs['!cols'] = CRM_CONSTANTS.EXCEL_COLUMNS.map(col => ({
      wch: Math.max(16, col.length + 3)
    }));
    XLSX.utils.book_append_sheet(wb, leadsWs, 'Leads');

    // 2. Activities Sheet
    const actData = (activitiesToExport || []).map(activityToRow);
    const actWs = XLSX.utils.json_to_sheet(actData, { header: CRM_CONSTANTS.ACTIVITY_COLUMNS });
    actWs['!cols'] = CRM_CONSTANTS.ACTIVITY_COLUMNS.map(col => ({
      wch: Math.max(16, col.length + 3)
    }));
    XLSX.utils.book_append_sheet(wb, actWs, 'Activities');

    // 3. Lists Sheet
    const listsWs = buildListsSheet();
    XLSX.utils.book_append_sheet(wb, listsWs, 'Lists');

    // 4. Users Sheet
    const usersData = CRM_CONSTANTS.USERS.map(u => ({
      'UserID': u.userId,
      'Name': u.name,
      'Email': u.email,
      'Role': u.role,
      'Active': u.active ? 'Yes' : 'No'
    }));
    const usersWs = XLSX.utils.json_to_sheet(usersData);
    XLSX.utils.book_append_sheet(wb, usersWs, 'Users');

    // 5. Transcripts Sheet (Full Audio Transcription Database)
    if (Array.isArray(recordingsToExport) && recordingsToExport.length > 0) {
      const transHeaders = [
        'RecordingID', 'LeadID', 'AttendeeName', 'Organisation', 'RecordedAt', 'DurationSeconds',
        'Language', 'TranscriptionStatus', 'WhishperJobID', 'FullTranscriptText', 'EditedTranscriptText',
        'SummaryNotes', 'AudioRelativePath', 'StaffOwner'
      ];
      const leadsMap = new Map((leadsToExport || []).map(l => [l.leadId, l]));
      const transData = recordingsToExport.map(r => {
        const lead = leadsMap.get(r.leadId) || {};
        const fullTxt = r.fullText || (r.transcriptData && r.transcriptData.fullText) || '';
        const editedTxt = r.editedText || (r.transcriptData && r.transcriptData.editedText) || '';
        const effective = editedTxt || fullTxt;
        const summary = effective ? (effective.slice(0, 140) + (effective.length > 140 ? '...' : '')) : '';
        return {
          'RecordingID': r.recordingId || '',
          'LeadID': r.leadId || '',
          'AttendeeName': lead.fullName || 'Attendee',
          'Organisation': lead.organisation || 'Organisation',
          'RecordedAt': r.createdAt || '',
          'DurationSeconds': r.durationSeconds != null ? r.durationSeconds : '',
          'Language': r.language || 'auto',
          'TranscriptionStatus': r.transcriptionStatus || 'pending',
          'WhishperJobID': r.whishperJobId || '',
          'FullTranscriptText': fullTxt,
          'EditedTranscriptText': editedTxt,
          'SummaryNotes': summary,
          'AudioRelativePath': r.audioRelativePath || '',
          'StaffOwner': r.createdBy || 'Staff'
        };
      });
      const transWs = XLSX.utils.json_to_sheet(transData, { header: transHeaders });
      transWs['!cols'] = transHeaders.map(col => ({
        wch: (col === 'FullTranscriptText' || col === 'EditedTranscriptText') ? 60 : Math.max(16, col.length + 2)
      }));
      XLSX.utils.book_append_sheet(wb, transWs, 'Transcripts');

      // 6. TranscriptSegments Sheet (Turn-by-turn timestamped dialogue)
      const segHeaders = [
        'RecordingID', 'LeadID', 'SegmentIndex', 'StartTime', 'EndTime', 'DurationSec', 'Speaker', 'SegmentText'
      ];
      const allSegments = [];
      recordingsToExport.forEach(r => {
        const segs = (r.transcriptData && r.transcriptData.segments) || r.segments || [];
        if (segs.length > 0) {
          segs.forEach((s, idx) => {
            const start = parseFloat(s.start || 0);
            const end = parseFloat(s.end || 0);
            allSegments.push({
              'RecordingID': r.recordingId || '',
              'LeadID': r.leadId || '',
              'SegmentIndex': idx + 1,
              'StartTime': start.toFixed(2) + 's',
              'EndTime': end.toFixed(2) + 's',
              'DurationSec': Math.max(0, +(end - start).toFixed(2)),
              'Speaker': s.speaker || 'Speaker',
              'SegmentText': s.text || ''
            });
          });
        } else if (r.fullText || (r.transcriptData && r.transcriptData.fullText)) {
          allSegments.push({
            'RecordingID': r.recordingId || '',
            'LeadID': r.leadId || '',
            'SegmentIndex': 1,
            'StartTime': '0.00s',
            'EndTime': (r.durationSeconds || 1).toFixed(2) + 's',
            'DurationSec': r.durationSeconds || 1,
            'Speaker': 'Speaker',
            'SegmentText': r.fullText || (r.transcriptData && r.transcriptData.fullText) || ''
          });
        }
      });
      if (allSegments.length > 0) {
        const segWs = XLSX.utils.json_to_sheet(allSegments, { header: segHeaders });
        segWs['!cols'] = segHeaders.map(col => ({
          wch: col === 'SegmentText' ? 60 : Math.max(14, col.length + 2)
        }));
        XLSX.utils.book_append_sheet(wb, segWs, 'TranscriptSegments');
      }

      // 7. Recordings Sheet
      const recHeaders = [
        'RecordingID', 'LeadID', 'CreatedAt', 'CreatedBy', 'DurationSeconds',
        'AudioSizeBytes', 'AudioRelativePath', 'AudioChecksum', 'TranscriptionStatus',
        'WhishperJobID', 'TranscriptRelativePath', 'Language', 'CompletedAt',
        'TranscriptPreview', 'ErrorMessage', 'EditedTranscriptAt'
      ];
      const recData = recordingsToExport.map(r => {
        const txt = r.editedText || r.fullText || (r.transcriptData && (r.transcriptData.editedText || r.transcriptData.fullText)) || '';
        return {
          'RecordingID': r.recordingId || '',
          'LeadID': r.leadId || '',
          'CreatedAt': r.createdAt || '',
          'CreatedBy': r.createdBy || '',
          'DurationSeconds': r.durationSeconds != null ? r.durationSeconds : '',
          'AudioSizeBytes': r.audioSizeBytes != null ? r.audioSizeBytes : '',
          'AudioRelativePath': r.audioRelativePath || '',
          'AudioChecksum': r.audioChecksum || '',
          'TranscriptionStatus': r.transcriptionStatus || '',
          'WhishperJobID': r.whishperJobId || '',
          'TranscriptRelativePath': r.transcriptRelativePath || '',
          'Language': r.language || '',
          'CompletedAt': r.completedAt || '',
          'TranscriptPreview': (txt.length > 100 ? txt.slice(0, 100) + '...' : txt),
          'ErrorMessage': r.errorMessage || '',
          'EditedTranscriptAt': r.editedTranscriptAt || ''
        };
      });
      const recWs = XLSX.utils.json_to_sheet(recData, { header: recHeaders });
      recWs['!cols'] = recHeaders.map(col => ({ wch: Math.max(16, col.length + 2) }));
      XLSX.utils.book_append_sheet(wb, recWs, 'Recordings');
    }

    return wb;
  }

  /**
   * Exports leads to .xlsx file download
   */
  function exportToExcel(leadsToExport, activitiesToExport, recordingsToExport = [], filenamePrefix = 'Anna_ETM2026_Leads') {
    const wb = createWorkbook(leadsToExport, activitiesToExport, recordingsToExport);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${filenamePrefix}_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /**
   * Exports leads to .csv file download
   */
  function exportToCsv(leadsToExport, filenamePrefix = 'Anna_ETM2026_Leads') {
    if (!window.XLSX) {
      throw new Error('SheetJS library is not available.');
    }
    const leadsData = leadsToExport.map(leadToRow);
    const ws = XLSX.utils.json_to_sheet(leadsData, { header: CRM_CONSTANTS.EXCEL_COLUMNS });
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return a.download;
  }

  /**
   * Exports an individual attendee's complete dossier to a dedicated CSV file
   */
  function exportSingleAttendeeCsv(lead, activities = [], recordings = []) {
    if (!lead) return null;
    if (!window.XLSX) {
      throw new Error('SheetJS library is not available.');
    }

    const rows = [];
    rows.push(['ANNA INCUBATOR ETM 2026 – INDIVIDUAL ATTENDEE CONVERSION DOSSIER']);
    rows.push(['Generated At', new Date().toISOString()]);
    rows.push(['Lead Reference ID', lead.leadId || '']);
    rows.push([]);

    rows.push(['--- 1. ATTENDEE CONTACT DETAILS ---', '']);
    rows.push(['Full Name', lead.fullName || '']);
    rows.push(['Job Title / Role', lead.jobTitle || '']);
    rows.push(['Email Address', lead.email || '']);
    rows.push(['Phone / WhatsApp', lead.phone || '']);
    rows.push(['Preferred Contact Channel', lead.preferredContactMethod || 'Email']);
    rows.push(['Country', lead.country || 'India']);
    rows.push(['Preferred Language', lead.preferredLanguage || '']);
    rows.push([]);

    rows.push(['--- 2. ORGANISATION & SECTORS ---', '']);
    rows.push(['Organisation Name', lead.organisation || '']);
    rows.push(['Organisation Type', lead.organisationType || '']);
    rows.push(['Organisation Size', lead.organisationSize || '']);
    rows.push(['Website', lead.organisationWebsite || '']);
    rows.push(['Location', lead.organisationLocation || '']);
    rows.push(['Sector Specialisation', Array.isArray(lead.sectors) ? lead.sectors.join('; ') : (lead.sectors || '')]);
    rows.push([]);

    rows.push(['--- 3. ETM 2026 CONTEXT & STARTUP EVALUATION ---', '']);
    rows.push(['Lead Source', lead.source || '']);
    rows.push(['Interaction Date', lead.interactionDate || '']);
    rows.push(['Priority Level', lead.priority || '']);
    rows.push(['Event Tracks', Array.isArray(lead.eventTracks) ? lead.eventTracks.join('; ') : (lead.eventTracks || '')]);
    rows.push(['Collaboration Interests', Array.isArray(lead.collaborationInterests) ? lead.collaborationInterests.join('; ') : (lead.collaborationInterests || '')]);
    rows.push(['Identified Problem / Need', lead.problemOrNeed || '']);
    rows.push(['Capability / Solution Offered', lead.capabilityOffered || '']);
    rows.push(['Technology Readiness Level (TRL)', lead.readinessLevel || '']);
    rows.push(['Estimated Opportunity Value', `${lead.currency || 'INR (₹)'} ${lead.estimatedValue != null ? lead.estimatedValue : 0}`]);
    rows.push([]);

    rows.push(['--- 4. CONVERSION PIPELINE & OWNERSHIP ---', '']);
    rows.push(['Conversion Stage', lead.stage || 'New']);
    rows.push(['Assigned Staff Owner', lead.owner || '']);
    rows.push(['Next Agreed Follow-up Date', lead.followUpDate || '']);
    rows.push(['Next Action Description', lead.nextAction || '']);
    rows.push(['Follow-up Outcome', lead.followUpOutcome || '']);
    rows.push(['Closed Reason', lead.closedReason || '']);
    rows.push([]);

    rows.push(['--- 5. CONSENT & EVENT NOTES ---', '']);
    rows.push(['Consent to Follow Up', lead.consent || '']);
    rows.push(['Consent Capture Method', lead.consentMethod || '']);
    rows.push(['Consent Notes', lead.consentNotes || '']);
    rows.push(['General Event Notes', lead.notes || '']);
    rows.push([]);

    rows.push(['--- 6. IN-PERSON AUDIO RECORDINGS & TRANSCRIPTS ---', '', '', '', '', '']);
    rows.push(['Recording ID', 'Created At', 'Staff Owner', 'Duration (Seconds)', 'Transcription Status', 'Transcript Content']);
    if (!recordings || recordings.length === 0) {
      rows.push(['None recorded yet', '—', '—', '0', '—', '—']);
    } else {
      recordings.forEach(rec => {
        rows.push([
          rec.recordingId || '',
          rec.createdAt || '',
          rec.createdBy || 'Staff',
          rec.durationSeconds != null ? String(rec.durationSeconds) : '0',
          rec.transcriptionStatus || 'pending',
          rec.fullText || rec.transcriptPreview || '—'
        ]);
      });
    }
    rows.push([]);

    rows.push(['--- 7. ACTIVITY & INTERACTION AUDIT LOG ---', '', '', '', '', '']);
    rows.push(['Activity ID', 'Timestamp', 'Activity Type', 'Staff Owner', 'Summary', 'Outcome']);
    if (!activities || activities.length === 0) {
      rows.push(['None logged yet', '—', '—', '—', '—', '—']);
    } else {
      activities.forEach(act => {
        rows.push([
          act.activityId || '',
          act.activityAt || '',
          act.activityType || '',
          act.owner || '',
          act.summary || '',
          act.outcome || ''
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeName = (lead.fullName || 'Attendee').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeOrg = (lead.organisation || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Attendee_${safeName}_${safeOrg ? safeOrg + '_' : ''}${lead.leadId || 'NEW'}.csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return filename;
  }

  /**
   * Standardizes incoming column name to internal field key
   */
  function mapHeaderToKey(header) {
    if (!header) return null;
    const clean = String(header).toLowerCase().replace(/[^a-z0-9]/g, '');

    const map = {
      'leadid': 'leadId',
      'id': 'leadId',
      'createdat': 'createdAt',
      'updatedat': 'updatedAt',
      'fullname': 'fullName',
      'name': 'fullName',
      'contactname': 'fullName',
      'jobtitle': 'jobTitle',
      'title': 'jobTitle',
      'role': 'jobTitle',
      'email': 'email',
      'emailaddress': 'email',
      'phone': 'phone',
      'whatsapp': 'phone',
      'phonenumber': 'phone',
      'preferredcontactmethod': 'preferredContactMethod',
      'contactmethod': 'preferredContactMethod',
      'country': 'country',
      'preferredlanguage': 'preferredLanguage',
      'language': 'preferredLanguage',
      'organisation': 'organisation',
      'organization': 'organisation',
      'company': 'organisation',
      'organisationtype': 'organisationType',
      'organizationtype': 'organisationType',
      'type': 'organisationType',
      'organisationwebsite': 'organisationWebsite',
      'organizationwebsite': 'organisationWebsite',
      'website': 'organisationWebsite',
      'organisationlocation': 'organisationLocation',
      'location': 'organisationLocation',
      'organisationsize': 'organisationSize',
      'size': 'organisationSize',
      'incubationinterest': 'incubationInterest',
      'incubation': 'incubationInterest',
      'ideatitle': 'ideaTitle',
      'idea': 'ideaTitle',
      'startupidea': 'ideaTitle',
      'primarysector': 'primarySector',
      'ideapitch': 'ideaPitch',
      'pitch': 'ideaPitch',
      'incubationsupport': 'incubationSupport',
      'support': 'incubationSupport',
      'ipstatus': 'ipStatus',
      'ip': 'ipStatus',
      'sectors': 'sectors',
      'sector': 'sectors',
      'source': 'source',
      'leadsource': 'source',
      'interactiondate': 'interactionDate',
      'eventtracks': 'eventTracks',
      'tracks': 'eventTracks',
      'collaborationinterests': 'collaborationInterests',
      'interests': 'collaborationInterests',
      'problemorneed': 'problemOrNeed',
      'problem': 'problemOrNeed',
      'need': 'problemOrNeed',
      'capabilityoffered': 'capabilityOffered',
      'solution': 'capabilityOffered',
      'capability': 'capabilityOffered',
      'readinesslevel': 'readinessLevel',
      'estimatedvalue': 'estimatedValue',
      'value': 'estimatedValue',
      'currency': 'currency',
      'priority': 'priority',
      'stage': 'stage',
      'stagechangedat': 'stageChangedAt',
      'owner': 'owner',
      'leadowner': 'owner',
      'assignedto': 'owner',
      'nextaction': 'nextAction',
      'followupdate': 'followUpDate',
      'followupoutcome': 'followUpOutcome',
      'outcome': 'followUpOutcome',
      'closedreason': 'closedReason',
      'conversiondate': 'conversionDate',
      'consent': 'consent',
      'consenttofollowup': 'consent',
      'consentat': 'consentAt',
      'consentmethod': 'consentMethod',
      'consentnotes': 'consentNotes',
      'notes': 'notes',
      'meetingnotes': 'notes',
      'archivedat': 'archivedAt',
      'totaltimespent': 'totalTimeSpentSeconds',
      'totaltimespentseconds': 'totalTimeSpentSeconds',
      'timespent': 'totalTimeSpentSeconds',
      'timespentseconds': 'totalTimeSpentSeconds',
      'consultationtime': 'totalTimeSpentSeconds'
    };

    return map[clean] || null;
  }

  /**
   * Parses raw imported file buffer (ArrayBuffer or binary string)
   * and builds an import preview report with column mapping & conflicts.
   */
  function inspectWorkbookFile(fileBuffer, currentLeads) {
    if (!window.XLSX) {
      throw new Error('SheetJS library is not loaded.');
    }

    const wb = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
    const sheetName = wb.Sheets['Leads'] ? 'Leads' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // Read headers
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rawRows || rawRows.length < 2) {
      throw new Error('The selected workbook appears to be empty or has no header row.');
    }

    const headers = rawRows[0];
    const columnMapping = {};
    const unmappedHeaders = [];

    headers.forEach((h, colIndex) => {
      const key = mapHeaderToKey(h);
      if (key) {
        columnMapping[colIndex] = key;
      } else {
        unmappedHeaders.push(h);
      }
    });

    const rowsAsObjects = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const validRows = [];
    const invalidRows = [];
    const conflicts = [];
    let toInsertCount = 0;
    let toUpdateCount = 0;

    rowsAsObjects.forEach((rawRow, idx) => {
      const rowNum = idx + 2;
      const leadObj = {};

      // Map values
      Object.entries(rawRow).forEach(([header, val]) => {
        const key = mapHeaderToKey(header);
        if (key) {
          // Parse stringified dates
          if (val instanceof Date) {
            leadObj[key] = val.toISOString().slice(0, 10);
          } else {
            leadObj[key] = typeof val === 'string' ? val.trim() : val;
          }
        }
      });

      // Split multi-select fields
      ['sectors', 'eventTracks', 'collaborationInterests', 'incubationSupport'].forEach(arrKey => {
        if (typeof leadObj[arrKey] === 'string') {
          leadObj[arrKey] = leadObj[arrKey]
            .split(/[,;]/)
            .map(s => s.trim())
            .filter(Boolean);
        } else if (!Array.isArray(leadObj[arrKey])) {
          leadObj[arrKey] = [];
        }
      });

      // Validation
      const errors = [];
      if (!leadObj.fullName) errors.push('Full name is required.');
      if (!leadObj.email) {
        errors.push('Email is required.');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadObj.email)) {
        errors.push('Invalid email format.');
      }
      if (!leadObj.organisation) errors.push('Organisation name is required.');

      // Default consent to 'No' if invalid
      if (!['Yes', 'No', 'Not asked'].includes(leadObj.consent)) {
        leadObj.consent = 'Not asked';
      }

      // Check conflict with existing leads
      const normEmail = (leadObj.email || '').toLowerCase();
      const existingMatch = currentLeads.find(l =>
        (leadObj.leadId && l.leadId === leadObj.leadId) ||
        (normEmail && (l.email || '').toLowerCase() === normEmail)
      );

      if (errors.length > 0) {
        invalidRows.push({
          rowNumber: rowNum,
          data: leadObj,
          errors
        });
      } else {
        validRows.push(leadObj);
        if (existingMatch) {
          toUpdateCount++;
          conflicts.push({
            rowNumber: rowNum,
            incoming: leadObj,
            existing: existingMatch,
            matchType: (leadObj.leadId && leadObj.leadId === existingMatch.leadId) ? 'LeadID' : 'Email'
          });
        } else {
          toInsertCount++;
        }
      }
    });

    return {
      sheetName,
      totalRows: rowsAsObjects.length,
      headers,
      columnMapping,
      unmappedHeaders,
      validRows,
      invalidRows,
      conflicts,
      toInsertCount,
      toUpdateCount
    };
  }

  function downloadServerExcelDatabase() {
    window.location.href = '/api/database/excel';
  }

  return {
    leadToRow,
    activityToRow,
    createWorkbook,
    exportToExcel,
    exportToCsv,
    exportSingleAttendeeCsv,
    inspectWorkbookFile,
    downloadServerExcelDatabase
  };
})();
