/**
 * Anna Incubator ETM 2026 Lead CRM - Duplicate Detection & Merge Engine
 * Checks normalized email, phone numbers, and name+organisation combinations.
 */

const CRM_Duplicates = (function() {

  function normalizeEmail(email) {
    if (!email) return '';
    return email.trim().toLowerCase();
  }

  function normalizePhone(phone) {
    if (!phone) return '';
    // Strip non-digits except leading +
    const clean = phone.replace(/[^\d+]/g, '');
    // Take last 10 digits for local comparison if long enough
    const digitsOnly = clean.replace(/\+/g, '');
    return digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
  }

  function normalizeString(str) {
    if (!str) return '';
    return str.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Checks if an incoming lead has duplicates in the existing lead list
   * @param {Object} candidate - The candidate lead object to check
   * @param {Array} existingLeads - The array of current leads
   * @param {string} currentLeadId - Optional ID to ignore (when editing existing)
   * @returns {Object|null} Match details or null if no duplicate
   */
  function findDuplicate(candidate, existingLeads, currentLeadId = null) {
    if (!candidate || !existingLeads || !existingLeads.length) return null;

    const candEmail = normalizeEmail(candidate.email);
    const candPhone = normalizePhone(candidate.phone);
    const candName = normalizeString(candidate.fullName);
    const candOrg = normalizeString(candidate.organisation);

    for (const lead of existingLeads) {
      if (currentLeadId && lead.leadId === currentLeadId) {
        continue;
      }

      // Tier 1: Normalized Email Match
      const leadEmail = normalizeEmail(lead.email);
      if (candEmail && leadEmail && candEmail === leadEmail) {
        return {
          isDuplicate: true,
          matchType: 'email',
          matchField: 'Email Address',
          matchValue: candidate.email,
          confidence: 'high',
          matchedLead: lead,
          reason: `Exact email match with existing contact (${lead.fullName}).`
        };
      }

      // Tier 2: Normalized Phone Match
      const leadPhone = normalizePhone(lead.phone);
      if (candPhone && leadPhone && candPhone.length >= 8 && candPhone === leadPhone) {
        return {
          isDuplicate: true,
          matchType: 'phone',
          matchField: 'Phone Number',
          matchValue: candidate.phone,
          confidence: 'high',
          matchedLead: lead,
          reason: `Phone number matches existing contact (${lead.fullName}).`
        };
      }

      // Tier 3: Combination of Name and Organisation Match
      const leadName = normalizeString(lead.fullName);
      const leadOrg = normalizeString(lead.organisation);
      if (candName && candOrg && leadName && leadOrg) {
        if (candName === leadName && candOrg === leadOrg) {
          return {
            isDuplicate: true,
            matchType: 'name_org',
            matchField: 'Name & Organisation',
            matchValue: `${candidate.fullName} at ${candidate.organisation}`,
            confidence: 'high',
            matchedLead: lead,
            reason: `Attendee with the same name and organisation is already registered.`
          };
        }
      }
    }

    return null;
  }

  /**
   * Smartly merges an incoming lead record into an existing record
   * @param {Object} existing - The current lead in the database
   * @param {Object} incoming - The new submission data
   * @returns {Object} Merged lead object
   */
  function mergeRecords(existing, incoming) {
    const now = new Date().toISOString();

    // Union multi-select sectors
    const combinedSectors = Array.from(new Set([
      ...(existing.sectors || []),
      ...(incoming.sectors || [])
    ]));

    // Union multi-select interests
    const combinedInterests = Array.from(new Set([
      ...(existing.collaborationInterests || []),
      ...(incoming.collaborationInterests || [])
    ]));

    // Union multi-select eventTracks
    const combinedTracks = Array.from(new Set([
      ...(existing.eventTracks || []),
      ...(incoming.eventTracks || [])
    ]));

    // Append notes with a clear separator
    let mergedNotes = existing.notes || '';
    if (incoming.notes && incoming.notes.trim()) {
      const stamp = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      mergedNotes = mergedNotes
        ? `${mergedNotes}\n\n[Merged on ${stamp}]: ${incoming.notes.trim()}`
        : incoming.notes.trim();
    }

    // Determine consent (Yes takes precedence)
    let mergedConsent = existing.consent;
    let mergedConsentAt = existing.consentAt;
    let mergedConsentMethod = existing.consentMethod;
    if (incoming.consent === 'Yes') {
      mergedConsent = 'Yes';
      mergedConsentAt = existing.consentAt || now;
      mergedConsentMethod = incoming.consentMethod || existing.consentMethod || 'In person';
    } else if (existing.consent !== 'Yes' && incoming.consent) {
      mergedConsent = incoming.consent;
    }

    // Construct merged object
    const merged = {
      ...existing,
      // Prefer incoming contact details if provided
      jobTitle: incoming.jobTitle || existing.jobTitle,
      phone: (incoming.phone && String(incoming.phone).trim()) || existing.phone || '',
      preferredContactMethod: incoming.preferredContactMethod || existing.preferredContactMethod || 'Phone',
      country: incoming.country || existing.country,
      preferredLanguage: incoming.preferredLanguage || existing.preferredLanguage,
      // Organisation
      organisation: incoming.organisation || existing.organisation,
      organisationType: incoming.organisationType || existing.organisationType,
      organisationWebsite: incoming.organisationWebsite || existing.organisationWebsite,
      organisationLocation: incoming.organisationLocation || existing.organisationLocation,
      organisationSize: incoming.organisationSize || existing.organisationSize,
      sectors: combinedSectors,
      // Event context
      eventTracks: combinedTracks,
      collaborationInterests: combinedInterests,
      problemOrNeed: incoming.problemOrNeed || existing.problemOrNeed,
      capabilityOffered: incoming.capabilityOffered || existing.capabilityOffered,
      readinessLevel: incoming.readinessLevel || existing.readinessLevel,
      estimatedValue: (incoming.estimatedValue && Number(incoming.estimatedValue) > 0)
        ? Number(incoming.estimatedValue)
        : existing.estimatedValue,
      currency: incoming.currency || existing.currency,
      priority: incoming.priority || existing.priority,
      // Pipeline
      stage: incoming.stage || existing.stage,
      owner: incoming.owner || existing.owner,
      nextAction: incoming.nextAction || existing.nextAction,
      followUpDate: incoming.followUpDate || existing.followUpDate,
      followUpOutcome: incoming.followUpOutcome || existing.followUpOutcome,
      // Consent
      consent: mergedConsent,
      consentAt: mergedConsentAt,
      consentMethod: mergedConsentMethod,
      consentNotes: incoming.consentNotes ? `${existing.consentNotes || ''} ${incoming.consentNotes}`.trim() : existing.consentNotes,
      // Notes
      notes: mergedNotes,
      updatedAt: now
    };

    return merged;
  }

  return {
    normalizeEmail,
    normalizePhone,
    findDuplicate,
    mergeRecords
  };
})();
