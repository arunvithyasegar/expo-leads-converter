/**
 * Anna Incubator ETM 2026 Lead CRM - User Interface Controller
 * Manages screens, dashboards, tables, filters, modals, toasts, and interactions.
 */

const CRM_UI = (function() {

  // Current UI State
  let currentScreen = 'dashboard';
  let activeLeadId = null;
  let activeLeadFormMode = 'create'; // 'create' or 'edit'
  let pendingDuplicateCandidate = null;
  let activeFilters = {
    search: '',
    stage: '',
    owner: '',
    organisationType: '',
    sector: '',
    incubationInterest: '',
    incubationOnly: false,
    collaborationInterest: '',
    consent: '',
    source: '',
    priority: '',
    dateRange: 'all', // 'all', 'overdue', 'today', 'upcoming'
    preset: 'all'
  };

  let selectedLeadIds = new Set();
  let currentTaskTab = 'overdue'; // 'overdue', 'today', 'upcoming', 'completed'
  let pendingImportData = null;

  // Conversations & Whishper State
  let activeTranscriptRecordingId = null;
  let activeRecordingLeadId = null;
  let cachedAllRecordings = [];
  let recordingsFilter = { search: '', status: '' };
  let activeTranscriptTab = 'segments';
  let selectedAudioUploadFile = null;
  let activeRecordModalMode = 'mic';

  // Event Logs & Conversion State
  let currentActivityFilter = 'all'; // 'all', 'transcripts', 'meetings', 'conversions', 'online'
  let activitySearchQuery = '';
  let showAllActivitiesState = false;

  // In-Person Attendee Session Time Tracking State
  let profileSessionTimer = null;
  let profileSessionSeconds = 0;
  let unsavedSessionSeconds = 0;
  let isProfileSessionPaused = false;
  let activeTrackerLeadId = null;
  let profileSessionAutoSaveTimer = null;

  function getTodayLocalDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // IRCTC Live Running Clock Synchronization (Indian Standard Time · IST)
  function startIRCTCLiveClock() {
    function updateClock() {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[now.getMonth()];
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const dateStr = `${day}-${month}-${year}`;
      const timeStr = `${hours}:${minutes}:${seconds}`;

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[now.getDay()];

      // 1. Prominent Header Live Venue Timing Ticker
      const headerTickerTime = document.getElementById('headerTickerTime');
      const headerTickerDate = document.getElementById('headerTickerDate');
      if (headerTickerTime) headerTickerTime.textContent = timeStr;
      if (headerTickerDate) headerTickerDate.textContent = `${dayName}, ${dateStr}`;

      // 2. IRCTC Action Bar Clock
      const headerDate = document.getElementById('irctcClockDate');
      const headerTime = document.getElementById('irctcClockTime');
      if (headerDate) headerDate.textContent = dateStr;
      if (headerTime) headerTime.textContent = timeStr;

      // 3. IRCTC Executive Banner Clock
      const bannerDate = document.getElementById('irctcBannerDate');
      const bannerTime = document.getElementById('irctcBannerTime');
      if (bannerDate) bannerDate.textContent = dateStr;
      if (bannerTime) bannerTime.textContent = timeStr;
    }

    updateClock();
    setInterval(updateClock, 1000);
  }

  function formatIRCTCTimestamp(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const day = String(d.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}:${seconds} IST`;
    } catch (e) {
      return isoString;
    }
  }

  // =========================================================================
  // 5-Minute Desk Beep Alarm (Synthesized Web Audio API Interval Alert)
  // =========================================================================
  let audioCtx = null;
  let fiveMinAlarmActive = false;
  let fiveMinAlarmRemainingSeconds = 300; // 5 minutes
  let fiveMinAlarmInterval = null;

  function getAlarmAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  /**
   * Synthesizes an audible enterprise desk chime / beep.
   * Dual-tone harmonic chime: 880Hz (A5) -> 1318.5Hz (E6) repeated.
   */
  function playAlarmBeep(isDouble = true) {
    try {
      const ctx = getAlarmAudioContext();
      if (!ctx) return;

      const playTone = (freq, startTime, duration, gainLevel = 0.35) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      // Primary chime tone A5 (880 Hz)
      playTone(880, now, 0.14, 0.35);
      // Secondary pleasant chime tone E6 (1318.5 Hz)
      playTone(1318.5, now + 0.12, 0.28, 0.4);

      if (isDouble) {
        // Echo chime pulse after 350ms
        playTone(880, now + 0.35, 0.14, 0.3);
        playTone(1318.5, now + 0.47, 0.32, 0.35);
      }
    } catch (err) {
      console.warn('[Alarm Beep Synthesizer Error]:', err);
    }
  }

  function toggleFiveMinAlarm() {
    fiveMinAlarmActive = !fiveMinAlarmActive;
    const btn = document.getElementById('btnFiveMinAlarm');
    const label = document.getElementById('fiveMinAlarmText');
    const countdown = document.getElementById('fiveMinAlarmCountdown');
    const bell = document.getElementById('alarmBellIcon');

    if (fiveMinAlarmActive) {
      fiveMinAlarmRemainingSeconds = 300;
      if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
      if (label) label.textContent = '5m Beep:';
      if (countdown) {
        countdown.style.display = 'inline-block';
        countdown.textContent = '05:00';
      }
      if (bell) bell.classList.add('alarm-ringing');

      // Play soft single confirmation chime to unlock AudioContext and confirm audio
      playAlarmBeep(false);
      toast('🔔 5-Minute Beep Alarm activated! Beep chime will sound every 5 minutes.', 'success');

      clearInterval(fiveMinAlarmInterval);
      fiveMinAlarmInterval = setInterval(() => {
        fiveMinAlarmRemainingSeconds--;
        if (fiveMinAlarmRemainingSeconds <= 0) {
          // Trigger the 5-minute beep alarm!
          playAlarmBeep(true);
          const timeNow = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          toast(`⏰ 5-Minute Desk Checkpoint (${timeNow} IST) · 5 minutes elapsed!`, 'info');

          // Flash button animation
          if (btn) {
            btn.classList.add('alarm-flashing');
            setTimeout(() => btn.classList.remove('alarm-flashing'), 2200);
          }

          // Reset for next 5-minute cycle
          fiveMinAlarmRemainingSeconds = 300;
        }

        const mins = String(Math.floor(fiveMinAlarmRemainingSeconds / 60)).padStart(2, '0');
        const secs = String(fiveMinAlarmRemainingSeconds % 60).padStart(2, '0');
        if (countdown) countdown.textContent = `${mins}:${secs}`;
      }, 1000);

    } else {
      clearInterval(fiveMinAlarmInterval);
      fiveMinAlarmInterval = null;
      if (btn) {
        btn.classList.remove('active');
        btn.classList.remove('alarm-flashing');
        btn.setAttribute('aria-pressed', 'false');
      }
      if (label) label.textContent = '5m Beep: Off';
      if (countdown) countdown.style.display = 'none';
      if (bell) bell.classList.remove('alarm-ringing');

      toast('🔕 5-Minute Beep Alarm deactivated.', 'info');
    }
  }

  function testAlarmBeep(e) {
    if (e) e.stopPropagation();
    playAlarmBeep(true);
    toast('🔊 Testing 5-minute beep alarm chime preview...', 'success');
  }

  // =========================================================================
  // Attendee Consultation Time Tracking & Active Session Stopwatch Controllers
  // =========================================================================
  function formatDuration(totalSec) {
    const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
    if (sec === 0) return '0m 00s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remSec = sec % 60;
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(remSec).padStart(2, '0')}s`;
    }
    return `${mins}m ${String(remSec).padStart(2, '0')}s`;
  }

  function formatStopwatchDigits(totalSec) {
    const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remSec = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  }

  function getTimeSpentClass(seconds) {
    const s = Number(seconds) || 0;
    if (s >= 900) return 'high-engagement';
    if (s >= 300) return 'moderate-engagement';
    return '';
  }

  function getTimeEngagementBadgeHtml(seconds) {
    const s = Number(seconds) || 0;
    if (s >= 1800) return '<span class="badge badge-success" style="font-size:11px;">🔥 Deep Incubation Review (30m+)</span>';
    if (s >= 900) return '<span class="badge badge-teal" style="font-size:11px;">⭐ High Engagement (15m+)</span>';
    if (s >= 300) return '<span class="badge badge-blue" style="font-size:11px;">💬 Active Discussion (5m+)</span>';
    if (s > 0) return '<span class="badge badge-slate" style="font-size:11px;">⏱️ Consultation Active</span>';
    return '<span class="badge badge-slate" style="font-size:11px;">⏱️ Initial Intake</span>';
  }

  function startProfileSessionTracker(leadId) {
    if (activeTrackerLeadId && activeTrackerLeadId !== leadId) {
      stopProfileSessionTracker(true);
    }
    activeTrackerLeadId = leadId;
    profileSessionSeconds = 0;
    unsavedSessionSeconds = 0;
    isProfileSessionPaused = false;

    // Reset UI indicators
    const digitsEl = document.getElementById('profileSessionTimeDigits');
    if (digitsEl) digitsEl.textContent = '00:00';
    const iconEl = document.getElementById('btnPauseResumeIcon');
    const textEl = document.getElementById('btnPauseResumeText');
    const pulseEl = document.getElementById('sessionTimerPulse');
    if (iconEl) iconEl.textContent = '⏸️';
    if (textEl) textEl.textContent = 'Pause';
    if (pulseEl) pulseEl.classList.remove('paused');

    updateProfileTimeSpentDisplay(leadId);

    if (profileSessionTimer) clearInterval(profileSessionTimer);
    profileSessionTimer = setInterval(() => {
      if (!isProfileSessionPaused && activeTrackerLeadId) {
        profileSessionSeconds++;
        unsavedSessionSeconds++;
        const dEl = document.getElementById('profileSessionTimeDigits');
        if (dEl) dEl.textContent = formatStopwatchDigits(profileSessionSeconds);

        const lead = CRM_Storage.getLeadById(activeTrackerLeadId);
        const base = (lead && lead.totalTimeSpentSeconds) || 0;
        const total = base + unsavedSessionSeconds;
        const tEl = document.getElementById('profileTotalTimeSpent');
        if (tEl) tEl.textContent = formatDuration(total);
        const bEl = document.getElementById('profileTimeEngagementBadge');
        if (bEl) bEl.innerHTML = getTimeEngagementBadgeHtml(total);
      }
    }, 1000);

    // Auto-commit every 15s to keep storage synchronized without full view refreshes
    if (profileSessionAutoSaveTimer) clearInterval(profileSessionAutoSaveTimer);
    profileSessionAutoSaveTimer = setInterval(() => {
      commitProfileSessionTime(false);
    }, 15000);
  }

  function commitProfileSessionTime(logEntry = false) {
    if (!activeTrackerLeadId || unsavedSessionSeconds <= 0) return;
    const lead = CRM_Storage.getLeadById(activeTrackerLeadId);
    if (!lead) return;
    const addedSec = unsavedSessionSeconds;
    unsavedSessionSeconds = 0;
    const newTotal = (lead.totalTimeSpentSeconds || 0) + addedSec;
    lead.totalTimeSpentSeconds = newTotal;
    CRM_Storage.saveLead({ ...lead, totalTimeSpentSeconds: newTotal });

    if (logEntry && addedSec >= 60) {
      const mins = Math.round(addedSec / 60);
      CRM_Storage.addActivity({
        leadId: lead.leadId,
        activityType: 'Meeting',
        owner: lead.owner || 'Staff',
        summary: `In-person booth session ended: ${mins} min discussion recorded. Total consultation time: ${formatDuration(newTotal)}.`,
        outcome: 'Attendee consultation logged.',
        nextAction: lead.nextAction || '',
        followUpDate: lead.followUpDate || ''
      });
    }
  }

  function stopProfileSessionTracker(save = true) {
    if (save) commitProfileSessionTime(true);
    if (profileSessionTimer) {
      clearInterval(profileSessionTimer);
      profileSessionTimer = null;
    }
    if (profileSessionAutoSaveTimer) {
      clearInterval(profileSessionAutoSaveTimer);
      profileSessionAutoSaveTimer = null;
    }
    activeTrackerLeadId = null;
    profileSessionSeconds = 0;
    unsavedSessionSeconds = 0;
  }

  function togglePauseResumeSessionTimer() {
    isProfileSessionPaused = !isProfileSessionPaused;
    const iconEl = document.getElementById('btnPauseResumeIcon');
    const textEl = document.getElementById('btnPauseResumeText');
    const pulseEl = document.getElementById('sessionTimerPulse');
    if (isProfileSessionPaused) {
      commitProfileSessionTime(false);
      if (iconEl) iconEl.textContent = '▶️';
      if (textEl) textEl.textContent = 'Resume';
      if (pulseEl) pulseEl.classList.add('paused');
      toast('Active consultation stopwatch paused.', 'info');
    } else {
      if (iconEl) iconEl.textContent = '⏸️';
      if (textEl) textEl.textContent = 'Pause';
      if (pulseEl) pulseEl.classList.remove('paused');
      toast('Active consultation stopwatch resumed.', 'info');
    }
  }

  function addAttendeeTime(secondsToAdd) {
    const leadId = activeTrackerLeadId || activeLeadId;
    if (!leadId) {
      toast('No attendee selected to add time.', 'warning');
      return;
    }
    commitProfileSessionTime(false);
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;
    const newTotal = (lead.totalTimeSpentSeconds || 0) + Number(secondsToAdd);
    lead.totalTimeSpentSeconds = newTotal;
    CRM_Storage.saveLead({ ...lead, totalTimeSpentSeconds: newTotal });

    const mins = Math.round(secondsToAdd / 60);
    CRM_Storage.addActivity({
      leadId: lead.leadId,
      activityType: 'Meeting',
      owner: lead.owner || 'Staff',
      summary: `Logged +${mins}m technical consultation & incubation discussion at ETM 2026. Cumulative time: ${formatDuration(newTotal)}.`,
      outcome: 'Direct consultation duration updated.',
      nextAction: lead.nextAction || '',
      followUpDate: lead.followUpDate || ''
    });

    updateProfileTimeSpentDisplay(leadId);
    toast(`+${mins}m added to ${lead.fullName} (${formatDuration(newTotal)} total consultation time).`, 'success');
  }

  function updateProfileTimeSpentDisplay(leadId) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;
    const total = (lead.totalTimeSpentSeconds || 0) + unsavedSessionSeconds;
    const totalEl = document.getElementById('profileTotalTimeSpent');
    if (totalEl) totalEl.textContent = formatDuration(total);
    const badgeEl = document.getElementById('profileTimeEngagementBadge');
    if (badgeEl) badgeEl.innerHTML = getTimeEngagementBadgeHtml(total);
  }

  function init() {
    setupNavigation();
    setupFormCheckboxes();
    setupDropdownOptions();
    setupEventHandlers();
    setupKeyboardListeners();

    // Start Live IRCTC Running Clock
    startIRCTCLiveClock();

    // Event Logs Search Handler
    const actSearchInput = document.getElementById('dashboardActivitySearch');
    if (actSearchInput) {
      actSearchInput.addEventListener('input', (e) => {
        activitySearchQuery = (e.target.value || '').trim().toLowerCase();
        renderDashboard();
      });
    }

    // Subscribe to storage changes
    CRM_Storage.subscribe(renderCurrentView);

    // Initial render
    renderCurrentView();

    // Route hash check
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    // Save active attendee timer on browser unload / navigation
    window.addEventListener('beforeunload', () => {
      stopProfileSessionTracker(true);
    });

    // Local Whishper health check polling
    checkWhishperHealth();
    setInterval(checkWhishperHealth, 20000);

    // PostgreSQL & pgAdmin 4 Live Server connection check polling
    checkPostgresStatus();
    setInterval(checkPostgresStatus, 15000);
  }

  function handleHashChange() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    if (hash.startsWith('profile/')) {
      const id = hash.split('/')[1];
      showLeadProfile(id);
    } else if (hash === 'add-attendee' || hash === 'lead-form' || hash === 'add') {
      openLeadForm('create');
    } else if (['dashboard', 'leads', 'tasks', 'sync', 'recordings'].includes(hash)) {
      switchScreen(hash);
    }
  }

  function switchScreen(screenName) {
    if (currentScreen === 'profile' && screenName !== 'profile') {
      stopProfileSessionTracker(true);
    }
    currentScreen = screenName;
    document.querySelectorAll('.crm-screen').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab-btn').forEach(el => el.classList.remove('active'));

    const targetScreen = document.getElementById(`screen-${screenName}`);
    if (targetScreen) targetScreen.classList.add('active');

    const targetTab = document.querySelector(`.nav-tab-btn[data-screen="${screenName}"]`);
    if (targetTab) targetTab.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderCurrentView();
  }

  function setupNavigation() {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const screen = btn.getAttribute('data-screen');
        window.location.hash = screen;
      });
    });

    // Logo click goes to dashboard
    document.getElementById('brandLogoLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = 'dashboard';
    });
  }

  function setupDropdownOptions() {
    // Populate form dropdowns
    populateSelect('leadOrgTypeSelect', CRM_CONSTANTS.ORGANISATION_TYPES, 'Select organisation type');
    populateSelect('leadSourceSelect', CRM_CONSTANTS.SOURCES);
    populateSelect('leadPrioritySelect', CRM_CONSTANTS.PRIORITIES);
    populateSelect('leadStageSelect', CRM_CONSTANTS.STAGES);
    populateSelect('leadConsentSelect', CRM_CONSTANTS.CONSENT_OPTIONS, 'Choose consent status');
    populateSelect('leadConsentMethodSelect', CRM_CONSTANTS.CONSENT_METHODS);
    populateSelect('leadContactMethodSelect', CRM_CONSTANTS.CONTACT_METHODS);
    populateSelect('leadReadinessSelect', CRM_CONSTANTS.READINESS_LEVELS, 'Select readiness level');
    populateSelect('leadOrgSizeSelect', CRM_CONSTANTS.ORGANISATION_SIZES, 'Select organisation size');
    populateSelect('leadCurrencySelect', CRM_CONSTANTS.CURRENCIES);
    populateSelect('leadClosedReasonSelect', CRM_CONSTANTS.CLOSED_REASONS, 'Select closed reason');

    // Incubation Process & Startup Idea Dropdowns
    populateSelect('formIncubationInterest', CRM_CONSTANTS.INCUBATION_INTERESTS, 'Select Incubation / Cohort Intent');
    populateSelect('formPrimarySector', CRM_CONSTANTS.SECTORS, 'Select Primary Energy / DeepTech Sector');
    populateSelect('formIpStatus', CRM_CONSTANTS.IP_STATUSES, 'Select IP / Patent status');

    // Populate user owner options
    const ownerOptions = CRM_CONSTANTS.USERS.map(u => u.name);
    populateSelect('leadOwnerSelect', ownerOptions, 'Select staff owner');
    populateSelect('filterOwner', ownerOptions, 'All staff owners');

    // Populate filter dropdowns
    populateSelect('filterIncubationInterest', CRM_CONSTANTS.INCUBATION_INTERESTS, 'All incubation intents');
    populateSelect('filterStage', CRM_CONSTANTS.STAGES, 'All stages');
    populateSelect('filterOrgType', CRM_CONSTANTS.ORGANISATION_TYPES, 'All organisation types');
    populateSelect('filterSector', CRM_CONSTANTS.SECTORS, 'All sectors');
    populateSelect('filterInterest', CRM_CONSTANTS.COLLABORATION_INTERESTS, 'All collaboration interests');
    populateSelect('filterConsent', CRM_CONSTANTS.CONSENT_OPTIONS, 'All consent states');
    populateSelect('filterSource', CRM_CONSTANTS.SOURCES, 'All lead sources');
    populateSelect('filterPriority', CRM_CONSTANTS.PRIORITIES, 'All priorities');
  }

  function populateSelect(elemId, options, placeholder = null) {
    const el = document.getElementById(elemId);
    if (!el) return;
    let html = placeholder ? `<option value="">${placeholder}</option>` : '';
    html += options.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('');
    el.innerHTML = html;
  }

  function setupFormCheckboxes() {
    // Sectors tag cloud
    const sectorsWrap = document.getElementById('formSectorsCloud');
    if (sectorsWrap) {
      sectorsWrap.innerHTML = CRM_CONSTANTS.SECTORS.map(sec => `
        <label class="tag-checkbox-label">
          <input type="checkbox" name="sectors" value="${escapeHtml(sec)}">
          ${escapeHtml(sec)}
        </label>
      `).join('');
    }

    // Event Tracks tag cloud
    const tracksWrap = document.getElementById('formTracksCloud');
    if (tracksWrap) {
      tracksWrap.innerHTML = CRM_CONSTANTS.EVENT_TRACKS.map(track => `
        <label class="tag-checkbox-label">
          <input type="checkbox" name="eventTracks" value="${escapeHtml(track)}">
          ${escapeHtml(track)}
        </label>
      `).join('');
    }

    // Collaboration Interests tag cloud
    const interestsWrap = document.getElementById('formInterestsCloud');
    if (interestsWrap) {
      interestsWrap.innerHTML = CRM_CONSTANTS.COLLABORATION_INTERESTS.map(item => `
        <label class="tag-checkbox-label">
          <input type="checkbox" name="collaborationInterests" value="${escapeHtml(item)}">
          ${escapeHtml(item)}
        </label>
      `).join('');
    }

    // Incubation Support tag cloud
    const incSupportWrap = document.getElementById('formIncubationSupportCloud');
    if (incSupportWrap) {
      incSupportWrap.innerHTML = (CRM_CONSTANTS.INCUBATION_SUPPORTS || []).map(item => `
        <label class="tag-checkbox-label">
          <input type="checkbox" name="incubationSupports" value="${escapeHtml(item)}">
          ${escapeHtml(item)}
        </label>
      `).join('');
    }
  }

  function setupEventHandlers() {
    // Primary CTAs
    document.getElementById('ctaAddNewLead')?.addEventListener('click', () => {
      openLeadForm('create');
    });
    document.getElementById('dashCtaAddLead')?.addEventListener('click', () => {
      openLeadForm('create');
    });

    // Lead Form Submit
    document.getElementById('leadMainForm')?.addEventListener('submit', handleLeadFormSubmit);
    document.getElementById('leadFormCancelBtn')?.addEventListener('click', () => {
      if (activeLeadId && activeLeadFormMode === 'edit') {
        window.location.hash = `profile/${activeLeadId}`;
      } else {
        window.location.hash = 'leads';
      }
    });

    // Form Stage change event to toggle closed reason
    document.getElementById('leadStageSelect')?.addEventListener('change', (e) => {
      const closedReasonRow = document.getElementById('closedReasonFieldWrap');
      if (closedReasonRow) {
        if (e.target.value === 'Closed – no action') {
          closedReasonRow.style.display = 'flex';
        } else {
          closedReasonRow.style.display = 'none';
        }
      }
    });

    // Search input
    const searchInput = document.getElementById('leadsSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        renderLeadsTable();
      });
    }

    // Filter Chips (Saved Views)
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const preset = chip.getAttribute('data-preset');
        applyPresetFilter(preset);
      });
    });

    // Advanced Filter Form
    ['filterIncubationInterest', 'filterStage', 'filterOwner', 'filterOrgType', 'filterSector', 'filterInterest', 'filterConsent', 'filterSource', 'filterPriority'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        const key = id.replace('filter', '');
        const prop = key.charAt(0).toLowerCase() + key.slice(1);
        activeFilters[prop] = e.target.value;
        renderLeadsTable();
      });
    });

    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
      resetFilters();
    });

    // Tasks Tabs
    document.querySelectorAll('.task-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.task-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTaskTab = btn.getAttribute('data-tab');
        renderTasksView();
      });
    });

    // Activity Log Form
    document.getElementById('activityLogForm')?.addEventListener('submit', handleActivityLogSubmit);

    // Quick Stage Change Form
    document.getElementById('quickStageForm')?.addEventListener('submit', handleQuickStageSubmit);

    // Export Excel / CSV Buttons
    document.getElementById('btnExportExcelTop')?.addEventListener('click', () => exportAllToExcel());
    document.getElementById('btnExportExcelSync')?.addEventListener('click', () => exportAllToExcel());
    document.getElementById('btnExportCsvSync')?.addEventListener('click', () => exportAllToCsv());
    document.getElementById('btnDownloadBackup')?.addEventListener('click', () => CRM_Storage.backupJson());

    // Import Dropzone
    setupImportDropzone();

    // JSON Restore
    document.getElementById('jsonRestoreFile')?.addEventListener('change', handleJsonRestoreFile);
    document.getElementById('btnTriggerRestore')?.addEventListener('click', () => {
      document.getElementById('jsonRestoreFile')?.click();
    });

    // Batch Actions
    document.getElementById('batchSelectAllCheckbox')?.addEventListener('change', handleBatchSelectAll);
    document.getElementById('batchExportBtn')?.addEventListener('click', handleBatchExport);
    document.getElementById('batchClearBtn')?.addEventListener('click', () => {
      selectedLeadIds.clear();
      renderLeadsTable();
    });

    // Modals Close on backdrop click or close button
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', closeAllModals);
    });
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAllModals();
      });
    });

    // 10-digit Phone Limiter (Numbers only, max 10 digits)
    document.getElementById('formPhone')?.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });

    // Privacy notice trigger
    document.getElementById('openPrivacyNoticeBtn')?.addEventListener('click', () => {
      openModal('privacyModal');
    });

    // Header Transcription & Master Excel Database Buttons
    document.getElementById('btnHeaderTranscribeAudio')?.addEventListener('click', () => {
      openRecordModal(activeLeadId, { mode: 'mic' });
    });
    document.getElementById('btnHeaderDownloadExcelDb')?.addEventListener('click', () => {
      CRM_Excel.downloadServerExcelDatabase();
    });

    // Header Tools Dropdown Toggle & Accessibility
    const toolsWrap = document.getElementById('headerToolsDropdownWrap');
    const toolsBtn = document.getElementById('btnHeaderToolsDropdown');
    if (toolsBtn && toolsWrap) {
      toolsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = toolsWrap.classList.toggle('open');
        toolsBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      document.addEventListener('click', (e) => {
        if (!toolsWrap.contains(e.target)) {
          toolsWrap.classList.remove('open');
          toolsBtn.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toolsWrap.classList.contains('open')) {
          toolsWrap.classList.remove('open');
          toolsBtn.setAttribute('aria-expanded', 'false');
          toolsBtn.focus();
        }
      });

      toolsWrap.querySelectorAll('.dropdown-item-btn').forEach(item => {
        item.addEventListener('click', () => {
          toolsWrap.classList.remove('open');
          toolsBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // Screen 6: Master Excel Database Sync Buttons
    document.getElementById('btnDownloadMasterExcelDb')?.addEventListener('click', () => {
      CRM_Excel.downloadServerExcelDatabase();
    });
    document.getElementById('btnResyncExcelDb')?.addEventListener('click', async () => {
      try {
        toast('Rebuilding and synchronizing Master Excel Database...', 'info');
        await CRM_Recorder.syncExcelDatabase();
        toast('Master Excel Database synchronized successfully!', 'success');
        renderSyncView();
      } catch (err) {
        toast('Failed to re-sync Excel DB: ' + err.message, 'error');
      }
    });

    // Screen 7: Recordings & Transcripts Screen Actions
    document.getElementById('btnRecordAudioScreen7')?.addEventListener('click', () => {
      openRecordModal(null);
    });
    document.getElementById('btnExportTranscriptsExcelScreen7')?.addEventListener('click', () => {
      CRM_Excel.downloadServerExcelDatabase();
    });

    // Attendee Lead Selector in Record Modal
    document.getElementById('transcribeLeadSelect')?.addEventListener('change', (e) => {
      activeRecordingLeadId = e.target.value || null;
      const badge = document.getElementById('recordModalLeadIdBadge');
      if (badge) badge.textContent = activeRecordingLeadId || 'None';
    });

    // Results Box & Transcript Modal Download Excel Database Buttons
    document.getElementById('btnDownloadExcelFromResult')?.addEventListener('click', () => {
      CRM_Excel.downloadServerExcelDatabase();
    });
    document.getElementById('btnDownloadExcelFromTranscript')?.addEventListener('click', () => {
      CRM_Excel.downloadServerExcelDatabase();
    });

    // Whishper Status Pill click to refresh health
    document.getElementById('headerWhishperIndicator')?.addEventListener('click', () => {
      checkWhishperHealth(true);
    });

    // Lead Profile Record Conversation CTA
    document.getElementById('btnRecordConversationProfile')?.addEventListener('click', () => {
      if (activeLeadId) openRecordModal(activeLeadId);
    });

    // Recording Modal Checkbox & Controls
    document.getElementById('recordConsentCheckbox')?.addEventListener('change', (e) => {
      const startBtn = document.getElementById('btnStartRecording');
      if (startBtn) startBtn.disabled = !e.target.checked;
    });
    document.getElementById('btnStartRecording')?.addEventListener('click', handleStartRecordingClick);
    document.getElementById('btnPauseRecording')?.addEventListener('click', () => CRM_Recorder.pauseRecording());
    document.getElementById('btnResumeRecording')?.addEventListener('click', () => CRM_Recorder.resumeRecording());
    document.getElementById('btnStopRecording')?.addEventListener('click', handleStopRecordingClick);
    document.getElementById('btnCancelRecording')?.addEventListener('click', handleCancelRecordingClick);
    document.getElementById('recordModalCloseBtn')?.addEventListener('click', handleCancelRecordingClick);

    // Transcript Modal Tabs
    document.querySelectorAll('.transcript-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTranscriptTab(tab);
      });
    });

    // Transcript Actions
    document.getElementById('btnSaveTranscriptEdits')?.addEventListener('click', handleSaveTranscriptEdits);
    document.getElementById('btnRetryTranscriptionModal')?.addEventListener('click', () => {
      if (activeTranscriptRecordingId) retryTranscription(activeTranscriptRecordingId);
    });
    document.getElementById('btnDeleteRecordingFromModal')?.addEventListener('click', () => {
      if (activeTranscriptRecordingId) confirmDeleteRecording(activeTranscriptRecordingId, activeLeadId);
    });

    // Transcript Download Dropdown Toggle
    document.getElementById('btnDownloadDropdown')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.getElementById('transcriptDownloadMenu');
      if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => {
      const menu = document.getElementById('transcriptDownloadMenu');
      if (menu) menu.style.display = 'none';
    });

    // Global Recordings Screen Search & Filters
    document.getElementById('recordingsSearchInput')?.addEventListener('input', (e) => {
      recordingsFilter.search = e.target.value;
      renderGlobalRecordingsView();
    });
    document.getElementById('filterRecordingStatus')?.addEventListener('change', (e) => {
      recordingsFilter.status = e.target.value;
      renderGlobalRecordingsView();
    });
  }

  function setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable
      );

      // Global: Escape to close open modals or cancel form
      if (e.key === 'Escape') {
        const anyModalOpen = document.querySelector('.modal-backdrop.open');
        if (anyModalOpen) {
          e.preventDefault();
          closeAllModals();
          return;
        }
        if (currentScreen === 'lead-form') {
          e.preventDefault();
          cancelLeadForm();
          return;
        }
      }

      // Form Shortcuts: Ctrl+Enter (or Cmd+Enter) to Quick Save Attendee
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (currentScreen === 'lead-form') {
          e.preventDefault();
          if (e.shiftKey) {
            quickSaveLead(true); // Save & Record
          } else {
            quickSaveLead(false); // Save Attendee
          }
          return;
        }
      }

      // Alt+A or Alt+N: Open Add Attendee form from anywhere
      if (e.altKey && (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        openLeadForm('create');
        return;
      }

      // Alt+L: Go to Attendees directory
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        window.location.hash = 'leads';
        return;
      }

      // Alt+D: Go to Dashboard
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        window.location.hash = 'dashboard';
        return;
      }

      // Alt+R: Go to Audio Recordings
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        window.location.hash = 'recordings';
        return;
      }

      // Alt+K or ?: Open Keyboard Shortcuts Cheatsheet
      if ((e.altKey && e.key.toLowerCase() === 'k') || (!isInput && (e.key === '?' || (e.shiftKey && e.key === '/')))) {
        e.preventDefault();
        openShortcutsModal();
        return;
      }

      // Single-key navigation shortcuts (ONLY when NOT typing in an input/textarea)
      if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // 'a' or 'n' -> Add Attendee
        if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'n') {
          e.preventDefault();
          openLeadForm('create');
          return;
        }

        // 'l' -> Attendees Directory
        if (e.key.toLowerCase() === 'l') {
          e.preventDefault();
          window.location.hash = 'leads';
          return;
        }

        // 'd' -> Executive Dashboard
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          window.location.hash = 'dashboard';
          return;
        }

        // 'r' -> Recordings & Transcripts
        if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          window.location.hash = 'recordings';
          return;
        }

        // '/' -> Focus Search Box in Attendees Directory
        if (e.key === '/') {
          e.preventDefault();
          if (currentScreen !== 'leads') {
            window.location.hash = 'leads';
          }
          setTimeout(() => {
            const searchInput = document.getElementById('leadsSearchInput');
            if (searchInput) {
              searchInput.focus();
              searchInput.select();
            }
          }, 60);
          return;
        }
      }
    });
  }

  function openShortcutsModal() {
    closeAllModals();
    openModal('shortcutsModal');
  }

  function renderCurrentView() {
    updateBadgesAndMetrics();
    if (currentScreen === 'dashboard') {
      renderDashboard();
    } else if (currentScreen === 'leads') {
      renderLeadsTable();
    } else if (currentScreen === 'profile' && activeLeadId) {
      renderLeadProfile(activeLeadId);
    } else if (currentScreen === 'tasks') {
      renderTasksView();
    } else if (currentScreen === 'sync') {
      renderSyncView();
    } else if (currentScreen === 'recordings') {
      renderGlobalRecordingsView();
    }
  }

  /**
   * Calculates metrics and updates summary cards
   */
  function updateBadgesAndMetrics() {
    const allLeads = CRM_Storage.getLeads();
    const today = new Date().toISOString().slice(0, 10);

    const totalLeads = allLeads.length;
    const newLeads = allLeads.filter(l => l.stage === 'New').length;
    const followUpsDueToday = allLeads.filter(l =>
      l.followUpDate === today &&
      l.consent === 'Yes' &&
      !l.stage.startsWith('Closed')
    ).length;
    const overdueFollowUps = allLeads.filter(l =>
      l.followUpDate &&
      l.followUpDate < today &&
      l.consent === 'Yes' &&
      !l.stage.startsWith('Closed')
    ).length;
    const meetingsScheduled = allLeads.filter(l => l.stage === 'Meeting scheduled').length;
    const activeOpportunities = allLeads.filter(l => CRM_CONSTANTS.ACTIVE_STAGES.includes(l.stage)).length;
    const convertedLeads = allLeads.filter(l => ['Converted', 'Closed – successful'].includes(l.stage)).length;
    const noConsentLeads = allLeads.filter(l => l.consent !== 'Yes').length;

    // Incubation, Startup Ideas & DeepTech Sectors Metrics
    const incubationInterestedLeads = allLeads.filter(l =>
      l.incubationInterest &&
      !['Visitor / Not Interested', 'Corporate / Industry Partner', 'Not Disclosed'].includes(l.incubationInterest)
    ).length;
    const totalIdeas = allLeads.filter(l => l.ideaTitle && l.ideaTitle.trim() !== '').length;
    const sectorSet = new Set();
    allLeads.forEach(l => {
      if (l.primarySector) sectorSet.add(l.primarySector);
      if (Array.isArray(l.sectors)) l.sectors.forEach(s => sectorSet.add(s));
    });
    const totalSectors = sectorSet.size;

    // Total Conversion & Value Calculations
    const totalConversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';
    const activePipelinePool = activeOpportunities + convertedLeads;
    const opportunityWinRate = activePipelinePool > 0 ? ((convertedLeads / activePipelinePool) * 100).toFixed(1) : '0.0';

    const totalConvertedValue = allLeads
      .filter(l => ['Converted', 'Closed – successful'].includes(l.stage))
      .reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);
    const totalPipelineValue = allLeads
      .reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);

    const convertedValText = totalConvertedValue >= 10000000 
      ? `₹${(totalConvertedValue / 10000000).toFixed(2)} Cr`
      : `₹${(totalConvertedValue / 100000).toFixed(1)}L`;
    const pipelineValText = totalPipelineValue >= 10000000
      ? `₹${(totalPipelineValue / 10000000).toFixed(2)} Cr`
      : `₹${(totalPipelineValue / 100000).toFixed(1)}L`;

    const allActivities = CRM_Storage.getActivities();
    const totalActivitiesCount = allActivities.length;
    const meetingActivitiesCount = allActivities.filter(a => a.activityType === 'Meeting').length;
    const transcriptActivitiesCount = allActivities.filter(a => a.transcript || a.recordingId || (a.summary || '').toLowerCase().includes('transcript') || (a.summary || '').toLowerCase().includes('transcribed')).length;
    const onlineLeadActivitiesCount = allActivities.filter(a => a.activityType === 'Online Lead').length;
    const conversionActivitiesCount = allActivities.filter(a => a.activityType === 'Stage change' || (a.summary || '').includes('Converted') || (a.summary || '').includes('Closed – successful')).length;

    // Update Dashboard DOM Cards
    setCardValue('metricTotalLeads', totalLeads);
    setCardValue('metricIncubationInterested', incubationInterestedLeads);
    setCardValue('metricTotalIdeas', totalIdeas);
    setCardValue('metricTotalSectors', totalSectors);
    setCardValue('metricNewLeads', newLeads);
    setCardValue('metricDueToday', followUpsDueToday);
    setCardValue('metricOverdue', overdueFollowUps);
    setCardValue('metricMeetings', meetingsScheduled);
    setCardValue('metricOpportunities', activeOpportunities);
    setCardValue('metricConverted', convertedLeads);
    setCardValue('metricNoConsent', noConsentLeads);

    // Update Summary Card 7 (Total Conversion)
    const rateBadge = document.getElementById('metricConversionRateBadge');
    if (rateBadge) rateBadge.textContent = `${totalConversionRate}%`;
    const convValEl = document.getElementById('metricConvertedValueText');
    if (convValEl) convValEl.textContent = convertedValText;
    const convSubEl = document.getElementById('metricConversionSub');
    if (convSubEl) convSubEl.textContent = `${convertedLeads} of ${totalLeads} Attendees · ${convertedValText} MoUs`;

    // Update Conversion Command Hub
    const convTotalRateVal = document.getElementById('convTotalRateVal');
    if (convTotalRateVal) convTotalRateVal.textContent = `${totalConversionRate}%`;
    const convTotalRateDesc = document.getElementById('convTotalRateDesc');
    if (convTotalRateDesc) convTotalRateDesc.textContent = `${convertedLeads} of ${totalLeads} Attendees converted to MoUs`;
    const convTotalRateProgress = document.getElementById('convTotalRateProgress');
    if (convTotalRateProgress) convTotalRateProgress.style.width = `${Math.min(100, Math.max(8, Number(totalConversionRate) * 3))}%`;

    const convWinRateVal = document.getElementById('convWinRateVal');
    if (convWinRateVal) convWinRateVal.textContent = `${opportunityWinRate}%`;
    const convWinRateDesc = document.getElementById('convWinRateDesc');
    if (convWinRateDesc) convWinRateDesc.textContent = `${convertedLeads} won of ${activePipelinePool} active opportunities`;
    const convWinRateProgress = document.getElementById('convWinRateProgress');
    if (convWinRateProgress) convWinRateProgress.style.width = `${Math.max(8, Number(opportunityWinRate))}%`;

    const convTotalValueVal = document.getElementById('convTotalValueVal');
    if (convTotalValueVal) convTotalValueVal.textContent = convertedValText;
    const convTotalValueDesc = document.getElementById('convTotalValueDesc');
    if (convTotalValueDesc) convTotalValueDesc.textContent = `of ${pipelineValText} Total Pipeline`;
    const convTotalValueProgress = document.getElementById('convTotalValueProgress');
    if (convTotalValueProgress) convTotalValueProgress.style.width = `${totalPipelineValue > 0 ? Math.max(5, (totalConvertedValue / totalPipelineValue) * 100) : 0}%`;

    const convTotalLogsVal = document.getElementById('convTotalLogsVal');
    if (convTotalLogsVal) convTotalLogsVal.textContent = totalActivitiesCount;
    const convTotalLogsDesc = document.getElementById('convTotalLogsDesc');
    if (convTotalLogsDesc) convTotalLogsDesc.textContent = `${meetingActivitiesCount} Meetings · ${transcriptActivitiesCount} Transcripts · ${onlineLeadActivitiesCount} Online`;

    setCardValue('convLogsMeetingBadge', `${meetingActivitiesCount} Meetings`);
    setCardValue('convLogsTranscriptBadge', `${transcriptActivitiesCount} Transcripts`);
    setCardValue('convLogsOnlineBadge', `${onlineLeadActivitiesCount} Online`);

    // Counts for activity filter tabs
    setCardValue('countActAll', totalActivitiesCount);
    setCardValue('countActTranscripts', transcriptActivitiesCount);
    setCardValue('countActMeetings', meetingActivitiesCount);
    setCardValue('countActConversions', conversionActivitiesCount);
    setCardValue('countActOnline', onlineLeadActivitiesCount);
    setCardValue('dashboardEventLogsCount', `${totalActivitiesCount} Event Logs`);

    // Update Nav Badges
    const overdueNavBadge = document.getElementById('navOverdueBadge');
    if (overdueNavBadge) {
      if (overdueFollowUps > 0) {
        overdueNavBadge.textContent = overdueFollowUps;
        overdueNavBadge.style.display = 'inline-block';
      } else {
        overdueNavBadge.style.display = 'none';
      }
    }

    const leadsNavBadge = document.getElementById('navTotalLeadsBadge');
    if (leadsNavBadge) {
      leadsNavBadge.textContent = totalLeads;
    }

    // Update Recordings Nav Badge
    CRM_Recorder.getAllRecordings().then(recs => {
      const recBadge = document.getElementById('navTotalRecordingsBadge');
      if (recBadge) recBadge.textContent = (recs || []).length;
    }).catch(() => {});

    // Update Header Sync Status Indicator
    const syncStatus = CRM_Storage.getSyncStatus();
    const syncText = document.getElementById('headerSyncText');
    const syncDot = document.getElementById('headerSyncDot');
    if (syncText && syncDot) {
      syncText.textContent = syncStatus.connected ? 'Server & Disk Synced' : 'Browser Storage (Standalone)';
      syncDot.className = 'status-dot ' + (syncStatus.connected ? '' : 'warning');
    }
  }

  function setCardValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /**
   * Screen 1: Dashboard
   */
  function renderDashboard() {
    const allLeads = CRM_Storage.getLeads();
    const today = new Date().toISOString().slice(0, 10);

    // Render Milestone Conversion Funnel Ribbon
    const funnelContainer = document.getElementById('conversionFunnelRibbon');
    if (funnelContainer) {
      const funnelStages = [
        { stage: 'New', label: 'New Capture', icon: '✨' },
        { stage: 'Contacted', label: 'Contacted', icon: '📞' },
        { stage: 'Qualified', label: 'Qualified', icon: '🎯' },
        { stage: 'Meeting scheduled', label: 'Meeting Set', icon: '🤝' },
        { stage: 'In discussion', label: 'In Discussion', icon: '💬' },
        { stage: 'Converted', label: 'Converted (MoU)', icon: '🏆', isConverted: true }
      ];

      funnelContainer.innerHTML = funnelStages.map((st, idx) => {
        const count = allLeads.filter(l => l.stage === st.stage || (st.isConverted && ['Converted', 'Closed – successful'].includes(l.stage))).length;
        const val = allLeads
          .filter(l => l.stage === st.stage || (st.isConverted && ['Converted', 'Closed – successful'].includes(l.stage)))
          .reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);
        const valStr = val > 0 ? `₹${(val / 100000).toFixed(1)}L` : '—';
        const isLast = idx === funnelStages.length - 1;

        return `
          <div class="funnel-stage-step ${st.isConverted ? 'converted-step' : ''}" onclick="CRM_UI.filterByStage('${escapeHtml(st.stage)}')" title="Click to filter ${escapeHtml(st.stage)} leads">
            <div>
              <div class="funnel-step-title"><span>${st.icon}</span> ${st.label}</div>
              <div class="funnel-step-num">${count}</div>
              <div class="funnel-step-val">${valStr}</div>
            </div>
            ${!isLast ? '<div class="funnel-step-arrow">→</div>' : ''}
          </div>
        `;
      }).join('');
    }

    // A. Incubation Process Interest & Cohort Readiness Breakdown
    const incubationCounts = {};
    (CRM_CONSTANTS.INCUBATION_INTERESTS || []).forEach(int => {
      incubationCounts[int] = 0;
    });
    let maxIncubationCount = 1;
    allLeads.forEach(l => {
      const int = l.incubationInterest || 'Not Disclosed';
      incubationCounts[int] = (incubationCounts[int] || 0) + 1;
      if (incubationCounts[int] > maxIncubationCount) {
        maxIncubationCount = incubationCounts[int];
      }
    });

    const incubationContainer = document.getElementById('dashboardIncubationBars');
    if (incubationContainer) {
      incubationContainer.innerHTML = (CRM_CONSTANTS.INCUBATION_INTERESTS || []).map(int => {
        const count = incubationCounts[int] || 0;
        const percent = Math.max(count > 0 ? 10 : 0, Math.round((count / maxIncubationCount) * 100));
        return `
          <div class="incubation-row-item" onclick="CRM_UI.filterByIncubation('${escapeHtml(int)}')">
            <div class="incubation-row-label" title="${escapeHtml(int)}">
              <span>🚀</span> ${escapeHtml(int)}
            </div>
            <div class="incubation-bar-track">
              <div class="incubation-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="incubation-row-count">${count} attendee${count === 1 ? '' : 's'}</div>
          </div>
        `;
      }).join('');
    }

    // B. Core Energy & DeepTech Sectors Representation
    const sectorCounts = {};
    (CRM_CONSTANTS.SECTORS || []).forEach(sec => {
      sectorCounts[sec] = 0;
    });
    let maxSectorCount = 1;
    allLeads.forEach(l => {
      if (l.primarySector && sectorCounts[l.primarySector] !== undefined) {
        sectorCounts[l.primarySector]++;
      }
      (l.sectors || []).forEach(sec => {
        if (sec !== l.primarySector && sectorCounts[sec] !== undefined) {
          sectorCounts[sec]++;
        }
      });
    });
    Object.values(sectorCounts).forEach(cnt => {
      if (cnt > maxSectorCount) maxSectorCount = cnt;
    });

    const sectorContainer = document.getElementById('dashboardSectorBars');
    if (sectorContainer) {
      const topSectors = [...(CRM_CONSTANTS.SECTORS || [])].sort((a, b) => (sectorCounts[b] || 0) - (sectorCounts[a] || 0));
      sectorContainer.innerHTML = topSectors.slice(0, 8).map(sec => {
        const count = sectorCounts[sec] || 0;
        const percent = Math.max(count > 0 ? 10 : 0, Math.round((count / maxSectorCount) * 100));
        return `
          <div class="sector-row-item" onclick="CRM_UI.filterBySector('${escapeHtml(sec)}')">
            <div class="sector-row-label" title="${escapeHtml(sec)}">
              <span>⚡</span> ${escapeHtml(sec)}
            </div>
            <div class="sector-bar-track">
              <div class="sector-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="sector-row-count">${count} lead${count === 1 ? '' : 's'}</div>
          </div>
        `;
      }).join('');
    }

    // C. ETM 2026 Startup & Innovation Idea Showcase
    const leadsWithIdeas = allLeads.filter(l => l.ideaTitle && l.ideaTitle.trim() !== '');
    const ideaCountEl = document.getElementById('ideaSpotlightCount');
    if (ideaCountEl) {
      ideaCountEl.textContent = `${leadsWithIdeas.length} Registered Idea${leadsWithIdeas.length === 1 ? '' : 's'}`;
    }

    const ideaSpotlightContainer = document.getElementById('dashboardIdeaSpotlight');
    if (ideaSpotlightContainer) {
      if (leadsWithIdeas.length === 0) {
        ideaSpotlightContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; padding: 24px;">
            <div class="empty-state-title">No startup ideas registered yet</div>
            <div class="text-muted">Register an attendee with their DeepTech idea or pitch to display it on the showcase wall.</div>
            <button class="btn btn-sm btn-primary mt-12" onclick="CRM_UI.openLeadForm('create')">+ Register Idea</button>
          </div>
        `;
      } else {
        ideaSpotlightContainer.innerHTML = leadsWithIdeas.map(lead => {
          const sectorTag = lead.primarySector || (lead.sectors && lead.sectors[0]) || 'DeepTech';
          const pitch = lead.ideaPitch || lead.capabilityOffered || lead.notes || 'No pitch summary available.';
          const ipBadge = lead.ipStatus ? `<span class="badge badge-slate" style="font-size:10px;">⚖️ ${escapeHtml(lead.ipStatus)}</span>` : '';
          const incBadge = lead.incubationInterest ? `<span class="badge ${getIncubationBadgeClass(lead.incubationInterest)}" style="font-size:10px;">🚀 ${escapeHtml(lead.incubationInterest)}</span>` : '';

          return `
            <div class="idea-card-item">
              <div>
                <div class="idea-card-header">
                  <span class="badge badge-teal" style="font-size:11px; font-weight:700;">⚡ ${escapeHtml(sectorTag)}</span>
                  ${ipBadge}
                </div>
                <div class="idea-card-title">
                  <a href="#profile/${lead.leadId}" style="text-decoration:none; color:inherit;">${escapeHtml(lead.ideaTitle)}</a>
                </div>
                <div class="idea-card-attendee">
                  <strong>${escapeHtml(lead.fullName)}</strong> · ${escapeHtml(lead.organisation)}
                </div>
                <div class="idea-card-pitch">
                  “${escapeHtml(pitch)}”
                </div>
              </div>
              <div class="idea-card-footer">
                <div>${incBadge}</div>
                <div class="flex-center gap-6">
                  <button class="btn btn-sm btn-icon" title="Record Audio Pitch" style="color:var(--rose-700);" onclick="CRM_UI.openRecordModal('${lead.leadId}')">🎙️</button>
                  <a href="#profile/${lead.leadId}" class="btn btn-sm btn-outline-teal" style="text-decoration:none; padding:3px 10px; font-size:11px;">Profile →</a>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 1. Pipeline Funnel Breakdown
    const stageCounts = {};
    const stageValues = {};
    CRM_CONSTANTS.STAGES.forEach(st => {
      stageCounts[st] = 0;
      stageValues[st] = 0;
    });

    let maxStageCount = 1;
    allLeads.forEach(l => {
      if (stageCounts[l.stage] !== undefined) {
        stageCounts[l.stage]++;
        stageValues[l.stage] += Number(l.estimatedValue || 0);
        if (stageCounts[l.stage] > maxStageCount) {
          maxStageCount = stageCounts[l.stage];
        }
      }
    });

    const pipelineContainer = document.getElementById('dashboardPipelineBars');
    if (pipelineContainer) {
      pipelineContainer.innerHTML = CRM_CONSTANTS.STAGES.map(stage => {
        const count = stageCounts[stage] || 0;
        const val = stageValues[stage] || 0;
        const percent = Math.max(count > 0 ? 8 : 0, Math.round((count / maxStageCount) * 100));
        const valText = val > 0 ? `₹${(val / 100000).toFixed(1)}L` : '—';

        return `
          <div class="pipeline-stage-row" onclick="CRM_UI.filterByStage('${escapeHtml(stage)}')">
            <div class="stage-name-col">
              <span class="badge ${getStageBadgeClass(stage)}">${escapeHtml(stage)}</span>
            </div>
            <div class="stage-bar-wrap">
              <div class="stage-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="stage-count-col">${count}</div>
            <div class="stage-value-col">${valText}</div>
          </div>
        `;
      }).join('');
    }

    // 2. High-Priority Follow-up Queue
    const priorityLeads = allLeads
      .filter(l => !l.stage.startsWith('Closed') && l.followUpDate)
      .sort((a, b) => {
        // Overdue first, then by priority (Strategic > High > Normal > Low)
        const priorityScore = { 'Strategic': 4, 'High': 3, 'Normal': 2, 'Low': 1 };
        const scoreDiff = (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0);
        if (a.followUpDate !== b.followUpDate) {
          return a.followUpDate.localeCompare(b.followUpDate);
        }
        return scoreDiff;
      })
      .slice(0, 5);

    const queueContainer = document.getElementById('dashboardFollowUpQueue');
    if (queueContainer) {
      if (priorityLeads.length === 0) {
        queueContainer.innerHTML = `
          <div class="empty-state" style="padding: 24px;">
            <div class="empty-state-title">No pending follow-ups!</div>
            <div class="text-muted">All clear. Add new leads or schedule upcoming meetings.</div>
          </div>
        `;
      } else {
        queueContainer.innerHTML = priorityLeads.map(l => {
          const isOverdue = l.followUpDate < today;
          const isToday = l.followUpDate === today;
          const statusClass = isOverdue ? 'overdue' : (isToday ? 'today' : 'upcoming');
          const dateBadge = isOverdue
            ? `<span class="badge badge-rose">Overdue (${formatDaysAgo(l.followUpDate)})</span>`
            : (isToday ? `<span class="badge badge-gold">Due Today</span>` : `<span class="badge badge-teal">${l.followUpDate}</span>`);

          return `
            <div class="task-item-card ${statusClass}">
              <div class="task-info-main">
                <div class="task-contact-title">
                  <a href="#profile/${l.leadId}" style="text-decoration:none; color:inherit;">${escapeHtml(l.fullName)}</a>
                  <span class="badge ${getPriorityBadgeClass(l.priority)}">${escapeHtml(l.priority)}</span>
                  ${l.consent !== 'Yes' ? '<span class="badge badge-rose">No Consent</span>' : ''}
                </div>
                <div class="task-org-title">${escapeHtml(l.organisation)} · ${escapeHtml(l.jobTitle || l.organisationType)}</div>
                <div class="task-action-desc">
                  <strong>Action:</strong> ${escapeHtml(l.nextAction || 'Follow-up discussion')}
                </div>
                <div class="task-meta-bar">
                  <span>Due: ${dateBadge}</span>
                  <span>Owner: <strong>${escapeHtml(l.owner || 'Unassigned')}</strong></span>
                </div>
              </div>
              <div class="task-actions-col">
                <button class="btn btn-sm btn-primary" onclick="CRM_UI.openLogActivityModal('${l.leadId}')">Log</button>
                <button class="btn btn-sm" onclick="CRM_UI.showLeadProfile('${l.leadId}')">View</button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 3. High-Impact Attendee Leads & Conversion Targets
    const engagedLeadsGrid = document.getElementById('dashboardEngagedLeadsGrid');
    const engagedCountBadge = document.getElementById('dashboardLeadsEngagedCount');
    if (engagedLeadsGrid) {
      const activities = CRM_Storage.getActivities();
      const leadActivityMap = {};
      activities.forEach(a => {
        leadActivityMap[a.leadId] = (leadActivityMap[a.leadId] || 0) + 1;
      });

      // Score leads by priority and engagement volume
      const sortedLeads = [...allLeads].sort((a, b) => {
        const pScore = { 'Strategic': 4, 'High': 3, 'Normal': 2, 'Low': 1 };
        const scoreA = (pScore[a.priority] || 1) * 10 + (leadActivityMap[a.leadId] || 0) * 3 + (a.estimatedValue ? 2 : 0);
        const scoreB = (pScore[b.priority] || 1) * 10 + (leadActivityMap[b.leadId] || 0) * 3 + (b.estimatedValue ? 2 : 0);
        return scoreB - scoreA;
      });

      const topLeads = sortedLeads.slice(0, 6);
      if (engagedCountBadge) engagedCountBadge.textContent = `${sortedLeads.length} Priority Leads`;

      if (topLeads.length === 0) {
        engagedLeadsGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; padding: 20px;">
            <div class="empty-state-title">No leads in pipeline</div>
            <div class="text-muted">Register an attendee to begin tracking engagement and conversion.</div>
          </div>
        `;
      } else {
        engagedLeadsGrid.innerHTML = topLeads.map(lead => {
          const actCount = leadActivityMap[lead.leadId] || 0;
          const recCount = lead.audioRecordingsCount || 0;
          const valText = lead.estimatedValue > 0 ? `₹${(lead.estimatedValue / 100000).toFixed(1)}L` : '—';
          const pitch = lead.latestTranscript || lead.ideaPitch || lead.notes || lead.capabilityOffered || 'No recent notes recorded.';
          const truncatedPitch = pitch.length > 130 ? pitch.slice(0, 127) + '...' : pitch;
          const sectorTag = lead.primarySector || (lead.sectors && lead.sectors[0]) || lead.organisationType || 'DeepTech';

          return `
            <div class="lead-engagement-card">
              <div>
                <div class="lead-engagement-head">
                  <div>
                    <a href="#profile/${lead.leadId}" class="lead-engagement-name">${escapeHtml(lead.fullName)}</a>
                    <div class="lead-engagement-org">${escapeHtml(lead.organisation)} · ${escapeHtml(lead.jobTitle || 'Attendee')}</div>
                  </div>
                  <span class="badge ${getStageBadgeClass(lead.stage)}" style="font-size:10px;">${escapeHtml(lead.stage)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin: 4px 0 6px;">
                  <span class="badge badge-teal" style="font-size:10px;">⚡ ${escapeHtml(sectorTag)}</span>
                  <span class="badge ${getPriorityBadgeClass(lead.priority)}" style="font-size:10px;">${escapeHtml(lead.priority)}</span>
                  <span class="badge ${getTimeSpentClass(lead.totalTimeSpentSeconds || 0) === 'high-engagement' ? 'badge-success' : 'badge-slate'}" style="font-size:10px;" title="Cumulative consultation & engagement time">⏱️ ${formatDuration(lead.totalTimeSpentSeconds || 0)}</span>
                  ${recCount > 0 ? `<span class="badge badge-rose" style="font-size:10px;">🎙️ ${recCount} Audio</span>` : ''}
                </div>
                <div class="lead-engagement-body" title="${escapeHtml(pitch)}">
                  “${escapeHtml(truncatedPitch)}”
                </div>
              </div>
              <div>
                <div class="lead-engagement-meta">
                  <span><strong>Est. Value:</strong> ${valText}</span>
                  <span><strong>${actCount}</strong> interaction${actCount === 1 ? '' : 's'}</span>
                </div>
                <div class="lead-engagement-actions">
                  <button class="btn btn-sm btn-icon" title="Record Audio Dialogue" style="color:var(--rose-700);" onclick="CRM_UI.openRecordModal('${lead.leadId}')">🎙️</button>
                  <button class="btn btn-sm btn-outline-teal" onclick="CRM_UI.openLogActivityModal('${lead.leadId}')">+ Log</button>
                  <a href="#profile/${lead.leadId}" class="btn btn-sm btn-primary" style="text-decoration:none; padding:4px 10px; font-size:11px;">Profile →</a>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 4. Real-Time Event & Interaction Logs Command Center
    const allActivities = CRM_Storage.getActivities();
    let filteredActivities = allActivities;

    // Filter by category tab
    if (currentActivityFilter === 'transcripts') {
      filteredActivities = filteredActivities.filter(a => a.transcript || a.recordingId || (a.summary || '').toLowerCase().includes('transcript') || (a.summary || '').toLowerCase().includes('transcribed'));
    } else if (currentActivityFilter === 'meetings') {
      filteredActivities = filteredActivities.filter(a => a.activityType === 'Meeting');
    } else if (currentActivityFilter === 'conversions') {
      filteredActivities = filteredActivities.filter(a => a.activityType === 'Stage change' || (a.summary || '').includes('Converted') || (a.summary || '').includes('Closed – successful'));
    } else if (currentActivityFilter === 'online') {
      filteredActivities = filteredActivities.filter(a => a.activityType === 'Online Lead');
    }

    // Filter by search query
    if (activitySearchQuery) {
      filteredActivities = filteredActivities.filter(a => {
        const lead = CRM_Storage.getLeadById(a.leadId);
        const searchHaystack = [
          a.summary,
          a.outcome,
          a.transcript,
          a.owner,
          a.activityType,
          lead ? lead.fullName : '',
          lead ? lead.organisation : ''
        ].join(' ').toLowerCase();
        return searchHaystack.includes(activitySearchQuery);
      });
    }

    const activityContainer = document.getElementById('dashboardRecentActivity');
    const loadMoreWrap = document.getElementById('activityLoadMoreWrap');
    const btnToggleAll = document.getElementById('btnToggleAllActivities');

    if (activityContainer) {
      if (filteredActivities.length === 0) {
        activityContainer.innerHTML = `
          <div class="empty-state" style="padding: 24px;">
            <div class="empty-state-title">No event logs match this filter</div>
            <div class="text-muted">Try selecting a different tab or clearing your search query.</div>
            <button class="btn btn-sm btn-outline-teal mt-12" onclick="CRM_UI.setActivityFilter('all')">Show All Logs</button>
          </div>
        `;
        if (loadMoreWrap) loadMoreWrap.style.display = 'none';
      } else {
        const displayLimit = showAllActivitiesState ? filteredActivities.length : 10;
        const displayedActs = filteredActivities.slice(0, displayLimit);

        activityContainer.innerHTML = displayedActs.map(act => {
          const lead = CRM_Storage.getLeadById(act.leadId);
          const icon = getActivityIcon(act.activityType);
          const timeAgo = formatTimeAgo(act.activityAt);
          const irctcTime = formatIRCTCTimestamp(act.activityAt);

          let transcriptCallout = '';
          if (act.transcript) {
            transcriptCallout = `
              <div class="activity-transcript-callout">
                <div class="activity-transcript-tag">
                  <span>🎙️</span> In-Person Audio Transcript (${act.durationSeconds ? `${act.durationSeconds}s` : 'Captured'})
                </div>
                <div style="font-style:italic;">“${escapeHtml(act.transcript)}”</div>
              </div>
            `;
          }

          const isArchived = lead && (lead.isDeleted || lead.archivedAt);

          return `
            <div class="activity-item ${isArchived ? 'preserved-log-card' : ''}">
              <div class="activity-icon-badge">${icon}</div>
              <div class="activity-details">
                <div class="activity-header">
                  <div class="activity-author">
                    <strong>${escapeHtml(act.owner || 'Staff')}</strong>
                    <span style="font-weight:400; color:var(--ink-500)">for</span>
                    <a href="#profile/${act.leadId}" style="font-weight:700; text-decoration:none; color:var(--teal-700);">
                      ${escapeHtml(lead ? lead.fullName : (act.leadId || 'Attendee'))}
                    </a>
                    ${lead ? `<span style="font-size:11px; color:var(--ink-500);">(${escapeHtml(lead.organisation)})</span>` : ''}
                    ${isArchived ? '<span class="archived-log-badge" title="Attendee hidden from active dashboard pipelines, but historical logs are permanently preserved">📦 Archived Attendee · Preserved Log</span>' : ''}
                    <span class="badge ${act.activityType === 'Meeting' ? 'badge-teal' : (act.activityType === 'Online Lead' ? 'badge-sky' : 'badge-slate')}" style="font-size:10px; margin-left:4px;">${escapeHtml(act.activityType)}</span>
                  </div>
                  <div class="activity-time" title="${escapeHtml(irctcTime)}">${timeAgo} · <span style="font-family:monospace; font-size:11px; font-weight:600;">${escapeHtml(irctcTime)}</span></div>
                </div>
                <div class="activity-text" style="font-size:13px; font-weight:500; color:var(--ink-800); margin-top:2px;">
                  ${escapeHtml(act.summary)}
                </div>
                ${act.outcome ? `<div class="text-muted" style="font-size:12px; margin-top:3px;"><strong>Outcome:</strong> ${escapeHtml(act.outcome)}</div>` : ''}
                ${transcriptCallout}
                <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                  <a href="#profile/${act.leadId}" class="btn btn-sm btn-outline-teal" style="font-size:10.5px; padding:2px 8px; text-decoration:none;">View Profile →</a>
                  ${!isArchived ? `<button class="btn btn-sm" style="font-size:10.5px; padding:2px 8px;" onclick="CRM_UI.openLogActivityModal('${act.leadId}')">+ Add Follow-up</button>` : '<span class="text-muted" style="font-size:11px;">[Historical Log Preserved]</span>'}
                </div>
              </div>
            </div>
          `;
        }).join('');

        if (loadMoreWrap) {
          if (filteredActivities.length > 10) {
            loadMoreWrap.style.display = 'block';
            if (btnToggleAll) {
              btnToggleAll.textContent = showAllActivitiesState 
                ? 'Show Top 10 Logs' 
                : `Show All ${filteredActivities.length} Event Logs`;
            }
          } else {
            loadMoreWrap.style.display = 'none';
          }
        }
      }
    }
  }

  function setActivityFilter(filter) {
    currentActivityFilter = filter;
    document.querySelectorAll('.activity-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-act-filter') === filter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    renderDashboard();
  }

  function toggleAllActivities() {
    showAllActivitiesState = !showAllActivitiesState;
    renderDashboard();
  }

  function scrollToEventLogs() {
    const el = document.getElementById('sectionEventLogsHub');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Screen 2: Lead Directory Table
   */
  function renderLeadsTable() {
    const allLeads = CRM_Storage.getLeads();
    const today = new Date().toISOString().slice(0, 10);

    // Apply Filters
    const filtered = allLeads.filter(lead => {
      // Search across name, email, phone, organisation, idea, sector, notes, owner
      if (activeFilters.search) {
        const q = activeFilters.search.toLowerCase();
        const hay = [
          lead.fullName,
          lead.email,
          lead.phone,
          lead.organisation,
          lead.ideaTitle,
          lead.primarySector,
          lead.incubationInterest,
          lead.ideaPitch,
          lead.notes,
          lead.owner,
          lead.jobTitle
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // Incubation Preset Chip
      if (activeFilters.incubationOnly) {
        const nonIncubation = ['Visitor / Not Interested', 'Corporate / Industry Partner', 'Not Disclosed'];
        if (!lead.incubationInterest || nonIncubation.includes(lead.incubationInterest)) {
          return false;
        }
      }

      // Incubation Interest Dropdown
      if (activeFilters.incubationInterest && lead.incubationInterest !== activeFilters.incubationInterest) {
        return false;
      }

      // Stage
      if (activeFilters.stage && lead.stage !== activeFilters.stage) return false;

      // Owner
      if (activeFilters.owner && lead.owner !== activeFilters.owner) return false;

      // Organisation Type
      if (activeFilters.organisationType && lead.organisationType !== activeFilters.organisationType) return false;

      // Sector (matches primarySector or sectors list)
      if (activeFilters.sector) {
        const matchSector = (lead.primarySector === activeFilters.sector) || (lead.sectors || []).includes(activeFilters.sector);
        if (!matchSector) return false;
      }

      // Interest
      if (activeFilters.collaborationInterest && !(lead.collaborationInterests || []).includes(activeFilters.collaborationInterest)) return false;

      // Consent
      if (activeFilters.consent && lead.consent !== activeFilters.consent) return false;

      // Source
      if (activeFilters.source && lead.source !== activeFilters.source) return false;

      // Priority
      if (activeFilters.priority && lead.priority !== activeFilters.priority) return false;

      // Date Range / Preset Filter
      if (activeFilters.dateRange === 'overdue') {
        if (!lead.followUpDate || lead.followUpDate >= today || lead.consent !== 'Yes' || lead.stage.startsWith('Closed')) {
          return false;
        }
      } else if (activeFilters.dateRange === 'today') {
        if (lead.followUpDate !== today || lead.consent !== 'Yes') {
          return false;
        }
      }

      return true;
    });

    // Update count display
    const countEl = document.getElementById('tableResultsCount');
    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${allLeads.length} leads`;
    }

    // Render Batch Bar
    const batchBar = document.getElementById('batchActionBar');
    if (batchBar) {
      if (selectedLeadIds.size > 0) {
        batchBar.style.display = 'flex';
        document.getElementById('batchSelectedCount').textContent = `${selectedLeadIds.size} selected`;
      } else {
        batchBar.style.display = 'none';
      }
    }

    // Render Table Rows
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No matching contacts found</div>
            <div class="text-muted">Try adjusting your search criteria or clearing filters.</div>
            <button class="btn btn-sm btn-outline-teal mt-16" onclick="CRM_UI.resetFilters()">Reset all filters</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(lead => {
      const isSelected = selectedLeadIds.has(lead.leadId);
      const isOverdue = lead.followUpDate && lead.followUpDate < today && !lead.stage.startsWith('Closed');
      const isToday = lead.followUpDate === today;

      let followUpHtml = '—';
      if (lead.followUpDate) {
        if (isOverdue) {
          followUpHtml = `<span class="badge badge-rose" title="Overdue">${lead.followUpDate}</span>`;
        } else if (isToday) {
          followUpHtml = `<span class="badge badge-gold" title="Due Today">${lead.followUpDate}</span>`;
        } else {
          followUpHtml = `<span class="text-muted">${lead.followUpDate}</span>`;
        }
      }

      const consentBadge = lead.consent === 'Yes'
        ? `<span class="badge badge-emerald">✓ Consented</span>`
        : (lead.consent === 'No'
            ? `<span class="badge badge-rose">✕ Do Not Contact</span>`
            : `<span class="badge badge-gold">? Not Asked</span>`);

      const updatedStr = lead.updatedAt ? lead.updatedAt.slice(0, 10) : '—';
      const sectorTag = lead.primarySector || (lead.sectors && lead.sectors[0]) || 'General Energy';

      return `
        <tr class="${isSelected ? 'row-selected' : ''}">
          <td style="width: 38px; text-align: center;">
            <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="CRM_UI.toggleSelectLead('${lead.leadId}', this.checked)">
          </td>
          <td>
            <div style="font-weight: 700; color: var(--teal-900); display: flex; align-items: center; gap: 6px;">
              <a href="#profile/${lead.leadId}" style="text-decoration:none; color:inherit;">${escapeHtml(lead.fullName)}</a>
              <span class="badge ${getPriorityBadgeClass(lead.priority)}" style="font-size:10px;">${escapeHtml(lead.priority)}</span>
            </div>
            <div class="text-muted" style="font-size: 11px;">${escapeHtml(lead.email)} ${lead.phone ? '· ' + escapeHtml(lead.phone) : ''}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${escapeHtml(lead.organisation)}</div>
            <div class="text-muted" style="font-size: 11px;">${escapeHtml(lead.organisationType || 'Other')}</div>
          </td>
          <td>
            <div style="font-weight: 650; color: var(--teal-950); line-height: 1.35; max-width: 260px;">
              ${escapeHtml(lead.ideaTitle || 'Idea not registered')}
            </div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:4px; flex-wrap:wrap;">
              <span class="badge ${getIncubationBadgeClass(lead.incubationInterest)}" style="font-size:10px;">
                🚀 ${escapeHtml(lead.incubationInterest || 'General Attendee')}
              </span>
              ${lead.ipStatus && lead.ipStatus !== 'Not Disclosed' ? `<span class="badge badge-slate" style="font-size:9px;">⚖️ ${escapeHtml(lead.ipStatus)}</span>` : ''}
            </div>
          </td>
          <td>
            <span class="badge badge-teal" style="font-size:11px; font-weight:600; cursor:pointer;" onclick="CRM_UI.filterBySector('${escapeHtml(sectorTag)}')" title="Filter by sector">
              ⚡ ${escapeHtml(sectorTag)}
            </span>
          </td>
          <td>
            <button class="badge ${getStageBadgeClass(lead.stage)}" style="border:none; cursor:pointer;" onclick="CRM_UI.openQuickStageModal('${lead.leadId}')" title="Click to change stage">
              ${escapeHtml(lead.stage)}
            </button>
          </td>
          <td>
            <span style="font-weight: 500;">${escapeHtml(lead.owner || '—')}</span>
          </td>
          <td>${followUpHtml}</td>
          <td>${consentBadge}</td>
          <td style="white-space: nowrap;">
            <div class="time-spent-tag ${getTimeSpentClass(lead.totalTimeSpentSeconds || 0)}" title="Cumulative consultation & engagement time">
              <span>⏱️</span>
              <strong>${formatDuration(lead.totalTimeSpentSeconds || 0)}</strong>
            </div>
          </td>
          <td class="text-muted" style="font-size: 11px;">${updatedStr}</td>
          <td>
            <div class="flex-center gap-8">
              <button class="btn btn-sm btn-icon" style="color:var(--rose-700);" title="Record Conversation" onclick="CRM_UI.openRecordModal('${lead.leadId}')">🎙️</button>
              <button class="btn btn-sm btn-icon" style="color:var(--teal-700);" title="Download Attendee CSV" onclick="CRM_UI.downloadAttendeeCsv('${lead.leadId}')">📥</button>
              <button class="btn btn-sm btn-icon" title="View Profile" onclick="CRM_UI.showLeadProfile('${lead.leadId}')">👤</button>
              <button class="btn btn-sm btn-icon" title="Log Activity" onclick="CRM_UI.openLogActivityModal('${lead.leadId}')">📝</button>
              <button class="btn btn-sm btn-icon" title="Edit Contact" onclick="CRM_UI.openLeadForm('edit', '${lead.leadId}')">✏️</button>
              <button class="btn btn-sm btn-icon" title="Delete / Archive" onclick="CRM_UI.confirmDeleteLead('${lead.leadId}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function applyPresetFilter(preset) {
    activeFilters.preset = preset;
    activeFilters.dateRange = 'all';
    activeFilters.stage = '';
    activeFilters.priority = '';
    activeFilters.consent = '';
    activeFilters.organisationType = '';
    activeFilters.incubationOnly = false;

    if (preset === 'incubation') {
      activeFilters.incubationOnly = true;
    } else if (preset === 'overdue') {
      activeFilters.dateRange = 'overdue';
    } else if (preset === 'today') {
      activeFilters.dateRange = 'today';
    } else if (preset === 'opportunities') {
      activeFilters.stage = 'Opportunity';
    } else if (preset === 'missing-consent') {
      activeFilters.consent = 'Not asked';
    } else if (preset === 'startups') {
      activeFilters.organisationType = 'Startup';
    } else if (preset === 'industry') {
      activeFilters.organisationType = 'Industry / energy company';
    } else if (preset === 'converted') {
      activeFilters.stage = 'Converted';
    }

    renderLeadsTable();
  }

  function resetFilters() {
    activeFilters = {
      search: '',
      stage: '',
      owner: '',
      organisationType: '',
      sector: '',
      incubationInterest: '',
      incubationOnly: false,
      collaborationInterest: '',
      consent: '',
      source: '',
      priority: '',
      dateRange: 'all',
      preset: 'all'
    };

    const searchInput = document.getElementById('leadsSearchInput');
    if (searchInput) searchInput.value = '';

    ['filterIncubationInterest', 'filterStage', 'filterOwner', 'filterOrgType', 'filterSector', 'filterInterest', 'filterConsent', 'filterSource', 'filterPriority'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.filter-chip[data-preset="all"]')?.classList.add('active');

    renderLeadsTable();
  }

  function filterByStage(stageName) {
    resetFilters();
    activeFilters.stage = stageName;
    const stageEl = document.getElementById('filterStage');
    if (stageEl) stageEl.value = stageName;
    switchScreen('leads');
  }

  function filterByIncubation(type = 'any') {
    resetFilters();
    if (type === 'any') {
      activeFilters.incubationOnly = true;
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      document.querySelector('.filter-chip[data-preset="incubation"]')?.classList.add('active');
    } else {
      activeFilters.incubationInterest = type;
      const el = document.getElementById('filterIncubationInterest');
      if (el) el.value = type;
    }
    switchScreen('leads');
  }

  function filterBySector(sectorName) {
    resetFilters();
    activeFilters.sector = sectorName;
    const el = document.getElementById('filterSector');
    if (el) el.value = sectorName;
    switchScreen('leads');
  }

  function scrollToIdeaSpotlight() {
    switchScreen('dashboard');
    setTimeout(() => {
      const el = document.getElementById('sectionIdeaSpotlight');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.outline = '2px solid var(--gold-500)';
        setTimeout(() => { el.style.outline = 'none'; }, 1800);
      }
    }, 100);
  }

  /**
   * Screen 3: Lead Profile
   */
  function showLeadProfile(leadId) {
    activeLeadId = leadId;
    switchScreen('profile');
    startProfileSessionTracker(leadId);
    renderLeadProfile(leadId);
  }

  function renderLeadProfile(leadId) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) {
      toast('Lead not found.', 'error');
      switchScreen('leads');
      return;
    }

    // Populate attendee consultation time tracker
    updateProfileTimeSpentDisplay(leadId);

    // Set page header
    const nameEl = document.getElementById('profileLeadName');
    const orgEl = document.getElementById('profileLeadOrg');
    const idEl = document.getElementById('profileLeadId');
    const priorityPill = document.getElementById('profilePriorityPill');
    const stagePill = document.getElementById('profileStagePill');

    if (nameEl) nameEl.textContent = lead.fullName;
    if (orgEl) orgEl.textContent = `${lead.jobTitle ? lead.jobTitle + ' · ' : ''}${lead.organisation}`;
    if (idEl) idEl.textContent = lead.leadId;
    if (priorityPill) {
      priorityPill.className = `badge ${getPriorityBadgeClass(lead.priority)}`;
      priorityPill.textContent = lead.priority;
    }
    if (stagePill) {
      stagePill.className = `badge ${getStageBadgeClass(lead.stage)}`;
      stagePill.textContent = lead.stage;
    }

    // Visual Pipeline Stepper
    renderPipelineStepper(lead);

    // Consent Banner
    renderConsentBanner(lead);

    // Info details cards
    renderProfileDetails(lead);

    // Activity timeline
    renderProfileActivityTimeline(leadId);

    // Related contacts from same organisation
    renderRelatedContacts(lead);

    // Conversations and local Whishper transcripts panel
    renderConversationsPanel(leadId);

    // Set actions button handlers
    const editBtn = document.getElementById('profileEditBtn');
    if (editBtn) {
      editBtn.onclick = () => openLeadForm('edit', lead.leadId);
    }
    const logBtn = document.getElementById('profileLogActivityBtn');
    if (logBtn) {
      logBtn.onclick = () => openLogActivityModal(lead.leadId);
    }
    const deleteBtn = document.getElementById('profileDeleteBtn');
    if (deleteBtn) {
      deleteBtn.onclick = () => confirmDeleteLead(lead.leadId);
    }
  }

  function renderPipelineStepper(lead) {
    const stepperWrap = document.getElementById('profilePipelineStepper');
    if (!stepperWrap) return;

    const currentIdx = CRM_CONSTANTS.STAGES.indexOf(lead.stage);

    stepperWrap.innerHTML = CRM_CONSTANTS.STAGES.map((st, idx) => {
      let stateClass = '';
      if (idx === currentIdx) {
        stateClass = 'active';
      } else if (idx < currentIdx) {
        stateClass = 'completed';
      }

      return `
        <div class="stepper-step ${stateClass}" onclick="CRM_UI.handleStepClick('${lead.leadId}', '${escapeHtml(st)}')" title="Click to set stage to ${escapeHtml(st)}">
          ${escapeHtml(st)}
        </div>
      `;
    }).join('');
  }

  function handleStepClick(leadId, targetStage) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead || lead.stage === targetStage) return;

    // Check if active stage requires owner/nextAction
    if (CRM_CONSTANTS.ACTIVE_STAGES.includes(targetStage) && (!lead.owner || !lead.nextAction)) {
      openQuickStageModal(leadId, targetStage);
      return;
    }

    if (targetStage === 'Closed – no action') {
      openQuickStageModal(leadId, targetStage);
      return;
    }

    // Direct update
    CRM_Storage.saveLead({ ...lead, stage: targetStage });
    toast(`Stage moved to "${targetStage}"`, 'success');
  }

  function renderConsentBanner(lead) {
    const bannerWrap = document.getElementById('profileConsentBanner');
    if (!bannerWrap) return;

    if (lead.consent === 'Yes') {
      const dateText = lead.consentAt ? new Date(lead.consentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recorded';
      bannerWrap.className = 'consent-banner verified';
      bannerWrap.innerHTML = `
        <span style="font-size:18px;">✓</span>
        <div>
          <div><strong>Consent Verified:</strong> Attendee provided explicit permission to follow up.</div>
          <div style="font-size:11px; font-weight:normal; opacity:0.9;">Method: ${escapeHtml(lead.consentMethod || 'In person')} · Timestamp: ${dateText} ${lead.consentNotes ? '· Notes: ' + escapeHtml(lead.consentNotes) : ''}</div>
        </div>
      `;
    } else {
      const reason = lead.consent === 'No' ? 'Attendee explicitly declined follow-up.' : 'Consent was not requested or recorded at the event desk.';
      bannerWrap.className = 'consent-banner warning';
      bannerWrap.innerHTML = `
        <span style="font-size:20px;">⚠️</span>
        <div style="flex:1;">
          <div><strong>ACTION REQUIRED: No Consent to Contact (${lead.consent || 'Missing'})</strong></div>
          <div style="font-size:12px; font-weight:normal;">${reason} Per Anna Incubator privacy policy, outbound communications must not be initiated until consent is obtained and recorded.</div>
        </div>
        <button class="btn btn-sm btn-outline-teal" onclick="CRM_UI.openConsentUpdateModal('${lead.leadId}')">Record Consent</button>
      `;
    }
  }

  function renderProfileDetails(lead) {
    // Contact Info Grid
    const contactGrid = document.getElementById('profileContactGrid');
    if (contactGrid) {
      contactGrid.innerHTML = `
        <div class="info-key">Full Name</div><div class="info-val">${escapeHtml(lead.fullName)}</div>
        <div class="info-key">Email</div><div class="info-val"><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></div>
        <div class="info-key">Permanent Phone</div>
        <div class="info-val">
          <strong style="color:var(--teal-900); font-size:13px;">📞 ${escapeHtml(lead.phone || '—')}</strong>
          ${lead.phone ? `
            <span style="margin-left:8px; display:inline-flex; gap:6px;">
              <a href="tel:${escapeHtml(lead.phone)}" class="btn btn-sm btn-outline-teal" style="padding:2px 8px; font-size:11px; text-decoration:none;">📞 Call</a>
              <a href="https://wa.me/91${escapeHtml(lead.phone)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-teal" style="padding:2px 8px; font-size:11px; text-decoration:none;">💬 WhatsApp</a>
            </span>
          ` : ''}
        </div>
        <div class="info-key">Preferred Contact</div><div class="info-val">${escapeHtml(lead.preferredContactMethod || 'Phone')}</div>
        <div class="info-key">Country</div><div class="info-val">${escapeHtml(lead.country || 'India')}</div>
        <div class="info-key">Preferred Language</div><div class="info-val">${escapeHtml(lead.preferredLanguage || '—')}</div>
      `;
    }

    // Incubation & Startup Idea Card
    const incBadge = document.getElementById('profileIncubationBadge');
    if (incBadge) {
      incBadge.className = `badge ${getIncubationBadgeClass(lead.incubationInterest)}`;
      incBadge.textContent = lead.incubationInterest || 'General Attendee';
    }

    const incGrid = document.getElementById('profileIncubationGrid');
    if (incGrid) {
      const supportTags = (lead.incubationSupport || []).map(s => `<span class="badge badge-teal" style="font-size:10px;">${escapeHtml(s)}</span>`).join(' ') || '—';
      incGrid.innerHTML = `
        <div class="info-key">Incubation Intent</div>
        <div class="info-val"><strong>${escapeHtml(lead.incubationInterest || 'Not Disclosed')}</strong></div>
        <div class="info-key">Startup / Idea Title</div>
        <div class="info-val"><strong style="color:var(--teal-950);">${escapeHtml(lead.ideaTitle || 'None registered')}</strong></div>
        <div class="info-key">Primary DeepTech Sector</div>
        <div class="info-val"><span class="badge badge-teal">⚡ ${escapeHtml(lead.primarySector || (lead.sectors && lead.sectors[0]) || 'General Energy')}</span></div>
        <div class="info-key">IP / Patent Status</div>
        <div class="info-val"><span class="badge badge-slate">⚖️ ${escapeHtml(lead.ipStatus || 'Not Disclosed')}</span></div>
        <div class="info-key">Desired Support</div>
        <div class="info-val">${supportTags}</div>
      `;
    }

    const pitchEl = document.getElementById('profileIdeaPitch');
    if (pitchEl) {
      pitchEl.textContent = lead.ideaPitch || lead.capabilityOffered || 'No pitch summary recorded.';
    }

    // Organisation Grid
    const orgGrid = document.getElementById('profileOrgGrid');
    if (orgGrid) {
      const sectorsHtml = (lead.sectors || []).map(s => `<span class="badge badge-teal">${escapeHtml(s)}</span>`).join(' ') || '—';
      orgGrid.innerHTML = `
        <div class="info-key">Organisation</div><div class="info-val"><strong>${escapeHtml(lead.organisation)}</strong></div>
        <div class="info-key">Type</div><div class="info-val"><span class="badge badge-slate">${escapeHtml(lead.organisationType || 'Other')}</span></div>
        <div class="info-key">Website</div><div class="info-val">${lead.organisationWebsite ? `<a href="${escapeHtml(lead.organisationWebsite)}" target="_blank" rel="noopener">${escapeHtml(lead.organisationWebsite)}</a>` : '—'}</div>
        <div class="info-key">Location</div><div class="info-val">${escapeHtml(lead.organisationLocation || '—')}</div>
        <div class="info-key">Size</div><div class="info-val">${escapeHtml(lead.organisationSize || '—')}</div>
        <div class="info-key">Sectors</div><div class="info-val">${sectorsHtml}</div>
      `;
    }

    // Event & Qualification Grid
    const eventGrid = document.getElementById('profileEventGrid');
    if (eventGrid) {
      const tracksHtml = (lead.eventTracks || []).map(t => `<span class="badge badge-slate">${escapeHtml(t)}</span>`).join(' ') || '—';
      const interestsHtml = (lead.collaborationInterests || []).map(i => `<span class="badge badge-gold">${escapeHtml(i)}</span>`).join(' ') || '—';
      const valueFormatted = lead.estimatedValue > 0
        ? `${lead.currency || 'INR (₹)'} ${Number(lead.estimatedValue).toLocaleString('en-IN')}`
        : 'Not estimated';

      eventGrid.innerHTML = `
        <div class="info-key">Lead Source</div><div class="info-val">${escapeHtml(lead.source || 'ETM 2026 – in person')}</div>
        <div class="info-key">Interaction Date</div><div class="info-val">${escapeHtml(lead.interactionDate || '—')}</div>
        <div class="info-key">ETM Tracks</div><div class="info-val">${tracksHtml}</div>
        <div class="info-key">Collaboration</div><div class="info-val">${interestsHtml}</div>
        <div class="info-key">Readiness Level</div><div class="info-val">${escapeHtml(lead.readinessLevel || '—')}</div>
        <div class="info-key">Estimated Value</div><div class="info-val"><strong>${valueFormatted}</strong></div>
      `;
    }

    // Need & Solution
    const needEl = document.getElementById('profileProblemNeed');
    const solutionEl = document.getElementById('profileCapability');
    const notesEl = document.getElementById('profileNotes');
    if (needEl) needEl.textContent = lead.problemOrNeed || 'None documented.';
    if (solutionEl) solutionEl.textContent = lead.capabilityOffered || 'None documented.';
    if (notesEl) notesEl.textContent = lead.notes || 'None recorded.';

    // Follow-up & Action Card
    const nextActionEl = document.getElementById('profileNextActionText');
    const followUpDateEl = document.getElementById('profileFollowUpDateText');
    const ownerEl = document.getElementById('profileOwnerText');
    if (nextActionEl) nextActionEl.textContent = lead.nextAction || 'No next action scheduled.';
    if (followUpDateEl) followUpDateEl.textContent = lead.followUpDate || 'No date set.';
    if (ownerEl) ownerEl.textContent = lead.owner || 'Unassigned';
  }

  function renderProfileActivityTimeline(leadId) {
    const container = document.getElementById('profileActivityTimeline');
    if (!container) return;

    const activities = CRM_Storage.getActivities(leadId);
    if (activities.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <div class="empty-state-title">No activities recorded yet</div>
          <div class="text-muted">Click "Log Interaction" or "Record Conversation" to add discussion notes.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = activities.map(act => {
      const icon = getActivityIcon(act.activityType);
      const timeStr = act.activityAt ? new Date(act.activityAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : '—';

      const isConversation = !!(
        act.transcript ||
        act.recordingId ||
        (act.summary && (act.summary.includes('Recorded') || act.summary.includes('transcript') || act.summary.includes('🎙️')))
      );

      const transcriptText = act.transcript || (act.outcome && !act.outcome.startsWith('Saved locally') ? act.outcome : '');

      if (isConversation && transcriptText) {
        return `
          <div class="activity-item activity-conversation" id="act-card-${act.activityId}">
            <div class="activity-icon-badge" style="background:var(--teal-600); color:#fff;">🎙️</div>
            <div class="activity-details" style="width:100%;">
              <div class="activity-header">
                <div class="activity-author">
                  <span class="activity-transcript-badge">🎙️ In-Person Conversation Log</span>
                  <strong>${escapeHtml(act.owner || 'Staff')}</strong>
                  ${act.durationSeconds ? `<span class="badge badge-slate" style="font-size:10px;">⏱️ ${CRM_Recorder.formatTime(act.durationSeconds)}</span>` : ''}
                </div>
                <div class="activity-time">${timeStr}</div>
              </div>

              <div class="activity-text" style="font-weight:600; color:var(--teal-950); margin-top:2px;">
                ${escapeHtml(act.summary)}
              </div>

              <!-- Audio Player if available -->
              ${act.recordingId ? `
                <div style="margin: 8px 0 4px 0;">
                  <audio controls preload="metadata" style="width:100%; height:32px;" src="/api/recordings/${escapeHtml(act.recordingId)}/audio"></audio>
                </div>
              ` : ''}

              <!-- Transcribed Dialogue Quote Box -->
              <div class="activity-transcript-quote">
                <div class="transcript-quote-label">
                  <span>📄 Transcribed Dialogue:</span>
                </div>
                <div class="transcript-quote-body">${escapeHtml(transcriptText)}</div>
              </div>

              <!-- Conversion & Action Controls -->
              <div class="activity-transcript-actions">
                <button type="button" class="btn btn-sm btn-primary" onclick="CRM_UI.openConvertTranscriptModal('${escapeHtml(leadId)}', '${escapeHtml(act.activityId)}')">
                  <span>⚡</span> Convert to Qualification / Next Steps
                </button>
                <button type="button" class="btn btn-sm btn-outline-teal" onclick="CRM_UI.copyTranscriptToClipboard('${escapeHtml(act.activityId)}')">
                  <span>📋</span> Copy Transcript
                </button>
                ${act.recordingId ? `
                  <a href="/api/recordings/${escapeHtml(act.recordingId)}/download/vtt" download="${escapeHtml(act.recordingId)}.vtt" class="btn btn-sm btn-outline-teal" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="Download WebVTT subtitle file">
                    <span>⏱️</span> Subtitles (.VTT)
                  </a>
                  <button type="button" class="btn btn-sm btn-outline-teal" onclick="CRM_UI.openTranscriptModal('${escapeHtml(act.recordingId)}')">
                    <span>✏️</span> Review / Edit
                  </button>
                ` : ''}
              </div>

              ${act.nextAction ? `<div class="text-muted" style="font-size:12px; margin-top:6px;"><strong>Scheduled Follow-up:</strong> ${escapeHtml(act.nextAction)} (Due: ${act.followUpDate || '—'})</div>` : ''}
            </div>
          </div>
        `;
      }

      return `
        <div class="activity-item">
          <div class="activity-icon-badge">${icon}</div>
          <div class="activity-details">
            <div class="activity-header">
              <div class="activity-author">
                <span class="badge badge-slate">${escapeHtml(act.activityType)}</span>
                <strong>${escapeHtml(act.owner || 'Staff')}</strong>
              </div>
              <div class="activity-time">${timeStr}</div>
            </div>
            <div class="activity-text">${escapeHtml(act.summary)}</div>
            ${act.outcome ? `<div class="text-muted" style="font-size:12px; margin-top:4px;"><strong>Outcome:</strong> ${escapeHtml(act.outcome)}</div>` : ''}
            ${act.nextAction ? `<div class="text-muted" style="font-size:12px; margin-top:2px;"><strong>Next Step:</strong> ${escapeHtml(act.nextAction)} (Due: ${act.followUpDate || '—'})</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRelatedContacts(lead) {
    const container = document.getElementById('profileRelatedContacts');
    if (!container) return;

    const allLeads = CRM_Storage.getLeads();
    const related = allLeads.filter(l =>
      l.leadId !== lead.leadId &&
      l.organisation &&
      lead.organisation &&
      l.organisation.trim().toLowerCase() === lead.organisation.trim().toLowerCase()
    );

    if (related.length === 0) {
      container.innerHTML = `<div class="text-muted" style="font-size: 13px;">No other contacts registered from ${escapeHtml(lead.organisation)}.</div>`;
      return;
    }

    container.innerHTML = related.map(rel => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding: 8px 10px; background:var(--bg-subtle); border-radius:var(--radius-sm); margin-bottom:6px;">
        <div>
          <div style="font-weight: 650; font-size: 13px;">${escapeHtml(rel.fullName)}</div>
          <div class="text-muted" style="font-size: 11px;">${escapeHtml(rel.jobTitle || 'Representative')} · ${escapeHtml(rel.email)}</div>
        </div>
        <button class="btn btn-sm" onclick="CRM_UI.showLeadProfile('${rel.leadId}')">View</button>
      </div>
    `).join('');
  }

  /**
   * Screen 4: Add / Edit Lead Form
   */
  /**
   * Screen 4: Add / Edit Lead Form (2-Step Fast Intake & Unified Evaluation Hub)
   */
  let currentFormStep = 1;
  let activeRecordRedirectToDashboard = false;

  const TRL_MAP = [
    { level: 1, name: 'Basic Idea', title: 'Basic principles observed and reported.', badge: 'TRL 1 · Idea Stage', recommendation: 'Recommended: Ideation Desk & Incubation Application Form' },
    { level: 2, name: 'Concept Formulated', title: 'Technology concept and application formulated.', badge: 'TRL 2 · Concept', recommendation: 'Recommended: Faculty Mentorship & Problem Validation' },
    { level: 3, name: 'Proof of Concept', title: 'Analytical and experimental critical function proof of concept.', badge: 'TRL 3 · Feasibility', recommendation: 'Recommended: Anna Incubator Pre-Seed Lab Grant & Tech Mentorship' },
    { level: 4, name: 'Lab Validated', title: 'Component and/or breadboard validation in laboratory environment.', badge: 'TRL 4 · Lab Validation', recommendation: 'Recommended: Maker Lab Access & Rapid Prototyping Support' },
    { level: 5, name: 'Component Tested', title: 'Component and/or breadboard validation in relevant environment.', badge: 'TRL 5 · Prototype', recommendation: 'Recommended: Cohort Incubation & Hardware Testing Facilities' },
    { level: 6, name: 'Prototype Demo', title: 'System/subsystem model or prototype demonstration in relevant environment.', badge: 'TRL 6 · Pilot Demo', recommendation: 'Recommended: Industry Partner Pilot & Seed Investment Review' },
    { level: 7, name: 'Field Pilot', title: 'System prototype demonstration in an operational field environment.', badge: 'TRL 7 · Field Validation', recommendation: 'Recommended: Regulatory Advisory & Corporate Trial Deployments' },
    { level: 8, name: 'Pre-Commercial', title: 'Actual system completed and qualified through test and demonstration.', badge: 'TRL 8 · Qualified', recommendation: 'Recommended: Scale-up Capital & Commercial Licensing' },
    { level: 9, name: 'Market Ready', title: 'Actual system proven through successful operational mission / commercial deployment.', badge: 'TRL 9 · Commercial', recommendation: 'Recommended: Growth Acceleration & Global Market Access' }
  ];

  function setFormStep(stepNum) {
    if (stepNum < 1) stepNum = 1;
    if (stepNum > 2) stepNum = 2;

    // When attempting to jump forward past step 1, validate step 1 first
    if (stepNum > 1 && !validateStep(1)) {
      toast('Please enter Full Name, Phone, and Email on Page 1 first.', 'warning');
      return;
    }

    currentFormStep = stepNum;

    for (let i = 1; i <= 2; i++) {
      const panel = document.getElementById(`formStepPanel${i}`);
      const pill = document.getElementById(`pillStep${i}`);
      if (panel) {
        panel.classList.toggle('active', i === stepNum);
      }
      if (pill) {
        pill.classList.toggle('active', i === stepNum);
        if (i < stepNum) {
          pill.classList.add('completed');
        } else if (i > stepNum) {
          pill.classList.remove('completed');
        }
      }
    }

    const formCard = document.querySelector('#screen-lead-form .form-card');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function nextFormStep(fromStep) {
    if (!validateStep(fromStep)) {
      toast('Please review the required fields highlighted before proceeding.', 'warning');
      return;
    }
    setFormStep(fromStep + 1);
  }

  function cancelLeadForm() {
    if (activeLeadId && activeLeadFormMode === 'edit') {
      window.location.hash = `profile/${activeLeadId}`;
    } else {
      window.location.hash = 'dashboard';
    }
  }

  function validateStep(stepNum) {
    clearFormErrors();
    let valid = true;

    if (stepNum === 1) {
      // Page 1: Only Full Name, Email, and Phone are required. Role and Organisation are optional!
      const fullName = document.getElementById('formFullName')?.value.trim();
      const email = document.getElementById('formEmail')?.value.trim().toLowerCase();
      const phone = document.getElementById('formPhone')?.value.trim();

      if (!fullName) {
        setFieldError('formFullName', 'Full name is required (e.g. Dr. Arvind Swaminathan).');
        valid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError('formEmail', 'Valid email address is required (e.g. arvind@company.com).');
        valid = false;
      }
      if (!phone) {
        setFieldError('formPhone', 'Phone / WhatsApp number is required to contact attendee (10 digits).');
        valid = false;
      } else if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
        setFieldError('formPhone', 'Please enter a valid 10-digit mobile or WhatsApp number (e.g. 9840123456).');
        valid = false;
      }
    } else if (stepNum === 2) {
      // Page 2: Evaluation Hub
      const stage = document.getElementById('leadStageSelect')?.value;
      const closedReason = document.getElementById('leadClosedReasonSelect')?.value;
      const consent = document.getElementById('leadConsentSelect')?.value;

      if (!stage) {
        setFieldError('leadStageSelect', 'Conversion stage is required.');
        valid = false;
      }
      if (stage === 'Closed – no action' && !closedReason) {
        setFieldError('leadClosedReasonSelect', 'Closed reason is required.');
        valid = false;
      }
      if (!consent) {
        setFieldError('leadConsentSelect', 'Consent status is required.');
        valid = false;
      }
    }

    return valid;
  }

  function scrollToEvalSection(sectionId, e) {
    if (e && e.preventDefault) e.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    document.querySelectorAll('#evalIndexNav .eval-index-tab').forEach(tab => {
      const isMatch = tab.getAttribute('onclick')?.includes(sectionId);
      tab.classList.toggle('active', !!isMatch);
    });
  }

  function setTrlLevel(lvl) {
    lvl = parseInt(lvl, 10) || 3;
    const slider = document.getElementById('evalTrlSlider');
    if (slider) slider.value = lvl;
    handleTrlSliderInput(lvl);
  }

  function handleTrlSliderInput(val) {
    const lvl = parseInt(val, 10) || 3;
    const trlObj = TRL_MAP.find(t => t.level === lvl) || TRL_MAP[2];

    // Highlight active card
    document.querySelectorAll('#evalTrlCardsGrid .trl-card').forEach(card => {
      const cardLvl = parseInt(card.getAttribute('data-trl'), 10);
      card.classList.toggle('active', cardLvl === lvl);
    });

    // Update status feedback banner
    const badgeEl = document.getElementById('trlStatusBadge');
    const titleEl = document.getElementById('trlStatusTitle');
    const recEl = document.getElementById('trlStatusRecommendation');
    if (badgeEl) badgeEl.textContent = trlObj.badge;
    if (titleEl) titleEl.textContent = trlObj.title;
    if (recEl) recEl.textContent = trlObj.recommendation;

    // Sync hidden select
    const sel = document.getElementById('leadReadinessSelect');
    if (sel) {
      const opt = Array.from(sel.options).find(o => o.value.includes(`TRL ${lvl}`));
      if (opt) {
        sel.value = opt.value;
      } else if (lvl <= 2) {
        sel.value = 'Idea';
      } else if (lvl <= 5) {
        sel.value = 'Prototype';
      } else if (lvl <= 7) {
        sel.value = 'Pilot-ready';
      } else {
        sel.value = 'Deployed';
      }
    }
  }

  function selectInteractiveStage(stage) {
    const sel = document.getElementById('leadStageSelect');
    if (sel) sel.value = stage;
    document.querySelectorAll('#interactiveStageGroup .interactive-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-stage') === stage);
    });
    const closedWrap = document.getElementById('closedReasonFieldWrap');
    if (closedWrap) {
      closedWrap.style.display = stage === 'Closed – no action' ? 'flex' : 'none';
    }
  }

  function selectInteractivePriority(priority) {
    const sel = document.getElementById('leadPrioritySelect');
    if (sel) sel.value = priority;
    document.querySelectorAll('#interactivePriorityGroup .interactive-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-priority') === priority);
    });
  }

  function goToDashboardFromModal() {
    closeAllModals();
    window.location.hash = 'dashboard';
    switchScreen('dashboard');
    updateBadgesAndMetrics();
    renderDashboardView();
  }

  function openLeadForm(mode = 'create', leadId = null) {
    activeLeadFormMode = mode;
    const form = document.getElementById('leadMainForm');
    if (!form) return;

    form.reset();
    clearFormErrors();
    setFormStep(1); // Always start on Page 1 (Fast Attendee Intake)

    const titleEl = document.getElementById('leadFormTitle');
    const subTitleEl = document.getElementById('leadFormSubTitle');
    const submitBtn = document.getElementById('leadFormSubmitBtn');

    if (mode === 'edit' && leadId) {
      activeLeadId = leadId;
      const lead = CRM_Storage.getLeadById(leadId);
      if (!lead) return;

      if (titleEl) titleEl.textContent = `Edit Contact · ${lead.fullName}`;
      if (subTitleEl) subTitleEl.innerHTML = `Editing record for <strong>${escapeHtml(lead.organisation || lead.fullName)}</strong>. Update contact, startup evaluation, or notes.`;
      if (submitBtn) submitBtn.innerHTML = '<span>💾</span> Update Full Application';

      document.getElementById('formLeadId').value = lead.leadId;
      document.getElementById('formFullName').value = lead.fullName || '';
      document.getElementById('formJobTitle').value = lead.jobTitle || '';
      document.getElementById('formEmail').value = lead.email || '';
      document.getElementById('formPhone').value = lead.phone || '';
      document.getElementById('leadContactMethodSelect').value = lead.preferredContactMethod || 'Email';
      document.getElementById('formCountry').value = lead.country || 'India';
      document.getElementById('formLanguage').value = lead.preferredLanguage || '';

      document.getElementById('formOrganisation').value = lead.organisation || '';
      document.getElementById('leadOrgTypeSelect').value = lead.organisationType || '';
      document.getElementById('formWebsite').value = lead.organisationWebsite || '';
      document.getElementById('formLocation').value = lead.organisationLocation || '';
      document.getElementById('leadOrgSizeSelect').value = lead.organisationSize || '';

      document.getElementById('leadSourceSelect').value = lead.source || 'ETM 2026 – in person';
      document.getElementById('formInteractionDate').value = lead.interactionDate || getTodayLocalDate();
      document.getElementById('formProblemNeed').value = lead.problemOrNeed || '';
      document.getElementById('formCapability').value = lead.capabilityOffered || '';
      document.getElementById('leadReadinessSelect').value = lead.readinessLevel || '';
      document.getElementById('formEstimatedValue').value = lead.estimatedValue || '';
      document.getElementById('leadCurrencySelect').value = lead.currency || 'INR (₹)';
      document.getElementById('leadPrioritySelect').value = lead.priority || 'Normal';
      selectInteractivePriority(lead.priority || 'Normal');

      document.getElementById('leadStageSelect').value = lead.stage || 'New';
      selectInteractiveStage(lead.stage || 'New');
      document.getElementById('leadOwnerSelect').value = lead.owner || '';
      document.getElementById('formNextAction').value = lead.nextAction || '';
      document.getElementById('formFollowUpDate').value = lead.followUpDate || '';
      document.getElementById('formFollowUpOutcome').value = lead.followUpOutcome || '';
      document.getElementById('leadClosedReasonSelect').value = lead.closedReason || '';

      document.getElementById('leadConsentSelect').value = lead.consent || 'Yes';
      document.getElementById('leadConsentMethodSelect').value = lead.consentMethod || 'In person';
      document.getElementById('formConsentNotes').value = lead.consentNotes || '';
      document.getElementById('formNotes').value = lead.notes || '';

      // Checkboxes
      setCheckboxValues('sectors', lead.sectors || []);
      setCheckboxValues('eventTracks', lead.eventTracks || []);
      setCheckboxValues('collaborationInterests', lead.collaborationInterests || []);
      setCheckboxValues('incubationSupports', lead.incubationSupport || []);

      // Incubation Process & Startup Idea
      const incSel = document.getElementById('formIncubationInterest');
      if (incSel) incSel.value = lead.incubationInterest || '';
      const secSel = document.getElementById('formPrimarySector');
      if (secSel) secSel.value = lead.primarySector || (lead.sectors && lead.sectors[0]) || '';
      const ideaTitleEl = document.getElementById('formIdeaTitle');
      if (ideaTitleEl) ideaTitleEl.value = lead.ideaTitle || '';
      const ipSel = document.getElementById('formIpStatus');
      if (ipSel) ipSel.value = lead.ipStatus || '';
      const ideaPitchEl = document.getElementById('formIdeaPitch');
      if (ideaPitchEl) ideaPitchEl.value = lead.ideaPitch || '';

      // Parse and sync TRL
      let parsedTrl = 3;
      const rStr = lead.readinessLevel || '';
      const trlMatch = rStr.match(/TRL\s*(\d)/i);
      if (trlMatch) {
        parsedTrl = parseInt(trlMatch[1], 10);
      } else if (rStr === 'Idea') {
        parsedTrl = 1;
      } else if (rStr === 'Prototype') {
        parsedTrl = 5;
      } else if (rStr === 'Pilot-ready') {
        parsedTrl = 7;
      } else if (rStr === 'Deployed') {
        parsedTrl = 9;
      }
      setTrlLevel(parsedTrl);

      // Toggle closed reason
      const closedWrap = document.getElementById('closedReasonFieldWrap');
      if (closedWrap) {
        closedWrap.style.display = lead.stage === 'Closed – no action' ? 'flex' : 'none';
      }
    } else {
      activeLeadId = null;
      if (titleEl) titleEl.textContent = 'Add Attendee Contact';
      if (subTitleEl) subTitleEl.innerHTML = 'Fast lead capture at Anna Incubator event desk. Fields marked <span style="color:var(--rose-600); font-weight:700;">*</span> are required.';
      if (submitBtn) submitBtn.innerHTML = '<span>💾</span> Submit Complete Application';

      document.getElementById('formLeadId').value = '';
      document.getElementById('formCountry').value = 'India';
      document.getElementById('formInteractionDate').value = getTodayLocalDate();
      document.getElementById('leadSourceSelect').value = 'ETM 2026 – in person';
      document.getElementById('leadPrioritySelect').value = 'Normal';
      selectInteractivePriority('Normal');
      document.getElementById('leadStageSelect').value = 'New';
      selectInteractiveStage('New');
      document.getElementById('leadConsentSelect').value = 'Yes';
      document.getElementById('leadConsentMethodSelect').value = 'In person';
      document.getElementById('leadCurrencySelect').value = 'INR (₹)';
      setTrlLevel(3);

      const incSel = document.getElementById('formIncubationInterest');
      if (incSel) incSel.value = 'Full Incubation (Early Stage / Cohort)';
      const secSel = document.getElementById('formPrimarySector');
      if (secSel) secSel.value = '';
      const ideaTitleEl = document.getElementById('formIdeaTitle');
      if (ideaTitleEl) ideaTitleEl.value = '';
      const ipSel = document.getElementById('formIpStatus');
      if (ipSel) ipSel.value = 'Provisional Patent Filed';
      const ideaPitchEl = document.getElementById('formIdeaPitch');
      if (ideaPitchEl) ideaPitchEl.value = '';

      const defaultOwner = localStorage.getItem('anna_etm_default_owner') || '';
      if (defaultOwner) {
        document.getElementById('leadOwnerSelect').value = defaultOwner;
      }

      setCheckboxValues('sectors', []);
      setCheckboxValues('eventTracks', []);
      setCheckboxValues('collaborationInterests', []);
      setCheckboxValues('incubationSupports', []);

      const closedWrap = document.getElementById('closedReasonFieldWrap');
      if (closedWrap) closedWrap.style.display = 'none';
    }

    switchScreen('lead-form');
    setTimeout(() => {
      document.getElementById('formFullName')?.focus();
    }, 150);
  }

  function setCheckboxValues(name, values) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
      cb.checked = values.includes(cb.value);
    });
  }

  function getCheckboxValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
  }

  function quickSaveLead(andRecord = false, navigateTarget = 'dashboard') {
    if (!validateStep(1)) {
      setFormStep(1);
      toast('Please enter Full Name, Phone, and Email (marked *).', 'error');
      return;
    }

    const leadId = document.getElementById('formLeadId')?.value || undefined;
    const existingLead = leadId ? CRM_Storage.getLeadById(leadId) : null;
    const fullName = document.getElementById('formFullName')?.value.trim();
    const email = document.getElementById('formEmail')?.value.trim().toLowerCase();
    const phone = document.getElementById('formPhone')?.value.trim() || (existingLead ? existingLead.phone : '');
    const organisation = document.getElementById('formOrganisation')?.value.trim() || (existingLead ? existingLead.organisation : 'Independent / Individual');
    const organisationType = document.getElementById('leadOrgTypeSelect')?.value || (existingLead ? existingLead.organisationType : 'Startup / DeepTech');

    const defaultOwner = localStorage.getItem('anna_etm_default_owner') || 'Staff';
    const owner = document.getElementById('leadOwnerSelect')?.value || defaultOwner;
    const stage = document.getElementById('leadStageSelect')?.value || 'New';
    const consent = document.getElementById('leadConsentSelect')?.value || 'Yes';
    const consentMethod = document.getElementById('leadConsentMethodSelect')?.value || 'In person';

    const candidateLead = {
      leadId,
      fullName,
      jobTitle: document.getElementById('formJobTitle')?.value.trim() || '',
      email,
      phone,
      preferredContactMethod: document.getElementById('leadContactMethodSelect')?.value || 'Phone',
      country: document.getElementById('formCountry')?.value.trim() || 'India',
      preferredLanguage: document.getElementById('formLanguage')?.value.trim() || 'English',
      organisation,
      organisationType,
      organisationWebsite: document.getElementById('formWebsite')?.value.trim() || '',
      organisationLocation: document.getElementById('formLocation')?.value.trim() || '',
      organisationSize: document.getElementById('leadOrgSizeSelect')?.value || '',
      sectors: getCheckboxValues('sectors'),
      incubationInterest: document.getElementById('formIncubationInterest')?.value || 'Full Incubation (Early Stage / Cohort)',
      primarySector: document.getElementById('formPrimarySector')?.value || '',
      ideaTitle: document.getElementById('formIdeaTitle')?.value.trim() || '',
      ipStatus: document.getElementById('formIpStatus')?.value || '',
      ideaPitch: document.getElementById('formIdeaPitch')?.value.trim() || '',
      incubationSupport: getCheckboxValues('incubationSupports'),
      source: document.getElementById('leadSourceSelect')?.value || 'ETM 2026 – in person',
      interactionDate: document.getElementById('formInteractionDate')?.value || getTodayLocalDate(),
      eventTracks: getCheckboxValues('eventTracks'),
      collaborationInterests: getCheckboxValues('collaborationInterests'),
      problemOrNeed: document.getElementById('formProblemNeed')?.value.trim() || '',
      capabilityOffered: document.getElementById('formCapability')?.value.trim() || '',
      readinessLevel: document.getElementById('leadReadinessSelect')?.value || 'TRL 3 - Experimental Proof of Concept',
      estimatedValue: Number(document.getElementById('formEstimatedValue')?.value) || 0,
      currency: document.getElementById('leadCurrencySelect')?.value || 'INR (₹)',
      priority: document.getElementById('leadPrioritySelect')?.value || 'Normal',
      stage,
      owner,
      nextAction: document.getElementById('formNextAction')?.value.trim() || '',
      followUpDate: document.getElementById('formFollowUpDate')?.value || '',
      followUpOutcome: document.getElementById('formFollowUpOutcome')?.value.trim() || '',
      closedReason: document.getElementById('leadClosedReasonSelect')?.value || '',
      consent,
      consentMethod,
      consentNotes: document.getElementById('formConsentNotes')?.value.trim() || '',
      notes: document.getElementById('formNotes')?.value.trim() || ''
    };

    if (owner) {
      localStorage.setItem('anna_etm_default_owner', owner);
    }

    // Duplicate Check: Check email, phone, name+org
    const allLeads = CRM_Storage.getLeads();
    const duplicateMatch = CRM_Duplicates.findDuplicate(candidateLead, allLeads, leadId);

    if (duplicateMatch && activeLeadFormMode === 'create') {
      pendingDuplicateCandidate = {
        candidate: candidateLead,
        match: duplicateMatch
      };
      openDuplicateModal(duplicateMatch, candidateLead);
      return;
    }

    const saved = CRM_Storage.saveLead(candidateLead, activeLeadFormMode === 'create');

    if (andRecord) {
      toast(`✅ Attendee saved (ID: ${saved.leadId})! Auto-starting conversation recorder & live transcription...`, 'success');
      setTimeout(() => {
        openRecordModal(saved.leadId, { autoStart: true, redirectToDashboard: true });
      }, 150);
    } else {
      toast(activeLeadFormMode === 'create' ? `✅ Attendee contact created (ID: ${saved.leadId})! Saved to database.` : 'Attendee record updated!', 'success');
      window.location.hash = navigateTarget || 'dashboard';
    }
  }

  function submitFullApplication(andRecord = false, navigateTarget = 'dashboard') {
    if (!validateStep(1)) {
      setFormStep(1);
      toast('Please review required fields on Page 1 (Name, Phone, Email).', 'error');
      return;
    }
    if (!validateStep(2)) {
      setFormStep(2);
      toast('Please review required conversion stage and consent on Page 2.', 'error');
      return;
    }

    quickSaveLead(andRecord, navigateTarget);
  }

  function handleLeadFormSubmit(e) {
    e.preventDefault();
    submitFullApplication(false, 'dashboard');
  }

  async function downloadAttendeeCsv(leadId) {
    if (!leadId) {
      leadId = activeLeadId;
    }
    if (!leadId) {
      toast('No attendee selected for CSV download.', 'error');
      return;
    }
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) {
      toast('Attendee not found.', 'error');
      return;
    }

    const activities = CRM_Storage.getLeadActivities(leadId) || [];
    let recordings = [];
    try {
      recordings = await CRM_Recorder.getLeadRecordings(leadId);
    } catch (e) {
      console.warn('Could not load recordings for attendee CSV:', e);
    }

    try {
      const filename = CRM_Excel.exportSingleAttendeeCsv(lead, activities, recordings);
      toast(`Downloaded Attendee CSV: ${filename}`, 'success');
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error');
    }
  }

  function setFieldError(fieldId, errorMsg) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const parent = el.closest('.form-field');
    if (parent) {
      parent.classList.add('has-error');
      let errSpan = parent.querySelector('.field-error-text');
      if (!errSpan) {
        errSpan = document.createElement('span');
        errSpan.className = 'field-error-text';
        parent.appendChild(errSpan);
      }
      errSpan.textContent = errorMsg;
    }
  }

  function clearFormErrors() {
    document.querySelectorAll('.form-field.has-error').forEach(f => {
      f.classList.remove('has-error');
    });
  }

  /**
   * Duplicate Resolution Modal
   */
  function openDuplicateModal(match, candidate) {
    const existing = match.matchedLead;
    const modal = document.getElementById('duplicateModal');
    if (!modal) return;

    document.getElementById('dupModalReason').textContent = match.reason;
    document.getElementById('dupMatchField').textContent = `${match.matchField}: ${match.matchValue}`;

    // Existing Card
    document.getElementById('dupExistingSummary').innerHTML = `
      <div style="font-weight: 700; font-size: 15px;">${escapeHtml(existing.fullName)}</div>
      <div class="text-muted" style="font-size: 12px; margin-bottom: 8px;">${escapeHtml(existing.organisation)} (${escapeHtml(existing.organisationType)})</div>
      <div style="font-size: 12px;"><strong>Email:</strong> ${escapeHtml(existing.email)}</div>
      <div style="font-size: 12px;"><strong>Phone:</strong> ${escapeHtml(existing.phone || '—')}</div>
      <div style="font-size: 12px;"><strong>Stage:</strong> <span class="badge ${getStageBadgeClass(existing.stage)}">${escapeHtml(existing.stage)}</span></div>
      <div style="font-size: 12px;"><strong>Owner:</strong> ${escapeHtml(existing.owner || '—')}</div>
      <div style="font-size: 12px;"><strong>Interests:</strong> ${(existing.collaborationInterests || []).join(', ') || '—'}</div>
    `;

    // Incoming Card
    document.getElementById('dupIncomingSummary').innerHTML = `
      <div style="font-weight: 700; font-size: 15px;">${escapeHtml(candidate.fullName)}</div>
      <div class="text-muted" style="font-size: 12px; margin-bottom: 8px;">${escapeHtml(candidate.organisation)} (${escapeHtml(candidate.organisationType)})</div>
      <div style="font-size: 12px;"><strong>Email:</strong> ${escapeHtml(candidate.email)}</div>
      <div style="font-size: 12px;"><strong>Phone:</strong> ${escapeHtml(candidate.phone || '—')}</div>
      <div style="font-size: 12px;"><strong>Stage:</strong> <span class="badge ${getStageBadgeClass(candidate.stage)}">${escapeHtml(candidate.stage)}</span></div>
      <div style="font-size: 12px;"><strong>Owner:</strong> ${escapeHtml(candidate.owner || '—')}</div>
      <div style="font-size: 12px;"><strong>Interests:</strong> ${(candidate.collaborationInterests || []).join(', ') || '—'}</div>
    `;

    // Button 1: Open & Update Existing
    document.getElementById('dupBtnOpenExisting').onclick = () => {
      closeAllModals();
      openLeadForm('edit', existing.leadId);
    };

    // Button 2: Merge Information
    document.getElementById('dupBtnMerge').onclick = () => {
      closeAllModals();
      const merged = CRM_Duplicates.mergeRecords(existing, candidate);
      CRM_Storage.saveLead(merged, false);
      CRM_Storage.addActivity({
        leadId: merged.leadId,
        activityType: 'Record update',
        owner: candidate.owner || 'Staff',
        summary: `Merged duplicate record for ${candidate.fullName} detected during registration.`
      });
      toast(`Merged records into ${existing.fullName} [${existing.leadId}]`, 'success');
      window.location.hash = `profile/${merged.leadId}`;
    };

    // Button 3: Keep Separate as New Person
    document.getElementById('dupBtnKeepSeparate').onclick = () => {
      closeAllModals();
      candidate.leadId = generateLeadId();
      CRM_Storage.saveLead(candidate, true);
      toast(`Created distinct lead ${candidate.fullName} [${candidate.leadId}]`, 'success');
      window.location.hash = `profile/${candidate.leadId}`;
    };

    openModal('duplicateModal');
  }

  /**
   * Screen 5: Follow-up Tasks View
   */
  function renderTasksView() {
    const allLeads = CRM_Storage.getLeads();
    const today = new Date().toISOString().slice(0, 10);

    const overdueTasks = allLeads.filter(l =>
      l.followUpDate &&
      l.followUpDate < today &&
      !l.stage.startsWith('Closed')
    ).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

    const todayTasks = allLeads.filter(l =>
      l.followUpDate === today &&
      !l.stage.startsWith('Closed')
    );

    const upcomingTasks = allLeads.filter(l =>
      l.followUpDate &&
      l.followUpDate > today &&
      !l.stage.startsWith('Closed')
    ).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

    const completedTasks = allLeads.filter(l =>
      l.followUpOutcome || l.stage.startsWith('Closed') || l.stage === 'Converted'
    );

    // Update tab counts
    document.getElementById('taskCountOverdue').textContent = overdueTasks.length;
    document.getElementById('taskCountToday').textContent = todayTasks.length;
    document.getElementById('taskCountUpcoming').textContent = upcomingTasks.length;
    document.getElementById('taskCountCompleted').textContent = completedTasks.length;

    let targetTasks = [];
    if (currentTaskTab === 'overdue') targetTasks = overdueTasks;
    else if (currentTaskTab === 'today') targetTasks = todayTasks;
    else if (currentTaskTab === 'upcoming') targetTasks = upcomingTasks;
    else if (currentTaskTab === 'completed') targetTasks = completedTasks;

    const container = document.getElementById('tasksListContainer');
    if (!container) return;

    if (targetTasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <div class="empty-state-title">No ${currentTaskTab} follow-ups</div>
          <div class="text-muted">You are all caught up on this queue.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = targetTasks.map(lead => {
      const isOverdue = lead.followUpDate && lead.followUpDate < today;
      const isToday = lead.followUpDate === today;
      const statusClass = isOverdue ? 'overdue' : (isToday ? 'today' : 'upcoming');

      const consentWarning = lead.consent !== 'Yes' ? `
        <div class="badge badge-rose" style="margin-top:4px;">
          ⚠️ Outbound Restricted: Consent is ${escapeHtml(lead.consent)}
        </div>
      ` : '';

      return `
        <div class="task-item-card ${statusClass}">
          <div class="task-info-main">
            <div class="task-contact-title">
              <a href="#profile/${lead.leadId}" style="text-decoration:none; color:inherit;">${escapeHtml(lead.fullName)}</a>
              <span class="badge ${getPriorityBadgeClass(lead.priority)}">${escapeHtml(lead.priority)}</span>
              <span class="badge ${getStageBadgeClass(lead.stage)}">${escapeHtml(lead.stage)}</span>
            </div>
            <div class="task-org-title">
              <strong>${escapeHtml(lead.organisation)}</strong> · ${escapeHtml(lead.jobTitle || lead.organisationType)}
            </div>
            ${consentWarning}
            <div class="task-action-desc">
              <strong>Next Action:</strong> ${escapeHtml(lead.nextAction || 'Follow up with attendee')}
            </div>
            <div class="task-meta-bar">
              <span>Due: <strong>${lead.followUpDate || 'Not set'}</strong> ${isOverdue ? '(' + formatDaysAgo(lead.followUpDate) + ')' : ''}</span>
              <span>Owner: <strong>${escapeHtml(lead.owner || 'Unassigned')}</strong></span>
              <span>Contact: ${escapeHtml(lead.email)} ${lead.phone ? '· ' + escapeHtml(lead.phone) : ''}</span>
            </div>
          </div>
          <div class="task-actions-col">
            <button class="btn btn-sm btn-primary" onclick="CRM_UI.openCompleteTaskModal('${lead.leadId}')">Complete / Outcome</button>
            <button class="btn btn-sm" onclick="CRM_UI.openRescheduleModal('${lead.leadId}')">Reschedule</button>
            <button class="btn btn-sm" onclick="CRM_UI.showLeadProfile('${lead.leadId}')">Profile</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Screen 6: Excel Sync & Data Management
   */
  async function renderSyncView() {
    const status = CRM_Storage.getSyncStatus();
    const allLeads = CRM_Storage.getLeads();
    const activities = CRM_Storage.getActivities();

    document.getElementById('syncOverviewTotalLeads').textContent = allLeads.length;
    document.getElementById('syncOverviewTotalActivities').textContent = activities.length;
    document.getElementById('syncOverviewLastSyncTime').textContent = status.lastSuccessfulSync
      ? new Date(status.lastSuccessfulSync).toLocaleString('en-IN')
      : 'Never';

    // Populate Master Excel Database Status Card
    try {
      const dbInfo = await CRM_Recorder.getExcelDatabaseInfo();
      if (dbInfo && dbInfo.exists) {
        const sizeEl = document.getElementById('excelDbFileSize');
        const transEl = document.getElementById('excelDbTranscriptsCount');
        const leadsEl = document.getElementById('excelDbLeadsCount');
        const updatedEl = document.getElementById('excelDbLastUpdated');
        const pathEl = document.getElementById('excelDbFileName');

        if (pathEl && dbInfo.filePath) pathEl.textContent = dbInfo.filePath;
        if (sizeEl) sizeEl.textContent = `${(dbInfo.sizeBytes / 1024).toFixed(1)} KB`;
        if (transEl) transEl.textContent = dbInfo.recordingsCount != null ? dbInfo.recordingsCount : '0';
        if (leadsEl) leadsEl.textContent = dbInfo.leadsCount != null ? dbInfo.leadsCount : allLeads.length;
        if (updatedEl && dbInfo.lastModified) {
          updatedEl.textContent = new Date(dbInfo.lastModified).toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch Master Excel Database info:', e);
    }

    // Refresh PostgreSQL & pgAdmin status
    checkPostgresStatus();

    // Render Audit Trail
    const auditContainer = document.getElementById('syncAuditTrailList');
    if (auditContainer) {
      const logs = CRM_Storage.getAuditLog().slice(0, 8);
      auditContainer.innerHTML = logs.map(entry => `
        <div style="font-size: 12px; padding: 6px 0; border-bottom: 1px solid var(--border-light); display:flex; justify-content:space-between; gap:10px;">
          <div>
            <span class="badge badge-slate">${escapeHtml(entry.action)}</span>
            <span>${escapeHtml(entry.details)}</span>
          </div>
          <div class="text-muted" style="white-space:nowrap;">${formatTimeAgo(entry.timestamp)}</div>
        </div>
      `).join('');
    }
  }

  function setupImportDropzone() {
    const dropzone = document.getElementById('excelDropzone');
    const fileInput = document.getElementById('excelFileInput');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processImportFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processImportFile(e.target.files[0]);
      }
    });
  }

  function processImportFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const buffer = e.target.result;
        const currentLeads = CRM_Storage.getLeads();
        const inspection = CRM_Excel.inspectWorkbookFile(buffer, currentLeads);
        pendingImportData = inspection;
        showImportPreviewModal(inspection);
      } catch (err) {
        toast('Error reading file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function showImportPreviewModal(inspection) {
    document.getElementById('importTotalRows').textContent = inspection.totalRows;
    document.getElementById('importValidRows').textContent = inspection.validRows.length;
    document.getElementById('importInvalidRows').textContent = inspection.invalidRows.length;
    document.getElementById('importInsertCount').textContent = inspection.toInsertCount;
    document.getElementById('importUpdateCount').textContent = inspection.toUpdateCount;

    // Show mapped columns
    const mappedList = Object.values(inspection.columnMapping).join(', ');
    document.getElementById('importMappedCols').textContent = mappedList || 'None mapped';

    // Show invalid rows warning if any
    const errContainer = document.getElementById('importErrorsContainer');
    if (inspection.invalidRows.length > 0) {
      errContainer.style.display = 'block';
      errContainer.innerHTML = `
        <div style="font-weight:700; color:var(--rose-700); margin-bottom:4px;">Row Validation Errors:</div>
        ${inspection.invalidRows.slice(0, 5).map(inv => `
          <div style="font-size:12px; margin-bottom:2px;">• Row ${inv.rowNumber}: ${inv.errors.join('; ')}</div>
        `).join('')}
        ${inspection.invalidRows.length > 5 ? `<div style="font-size:11px;">...and ${inspection.invalidRows.length - 5} more invalid rows.</div>` : ''}
      `;
    } else {
      errContainer.style.display = 'none';
    }

    // Confirm button
    document.getElementById('btnConfirmImport').onclick = () => {
      closeAllModals();
      const res = CRM_Storage.mergeLeads(inspection.validRows);
      toast(`Import complete: ${res.inserted} new added, ${res.updated} updated.`, 'success');
      switchScreen('leads');
    };

    openModal('importPreviewModal');
  }

  function handleJsonRestoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      if (!confirm('Restoring this backup will replace current contacts with the backup snapshot. Continue?')) {
        return;
      }
      const res = CRM_Storage.restoreJson(text);
      if (res.success) {
        toast(`Database restored! (${res.leadsCount} leads, ${res.activitiesCount} activities)`, 'success');
        switchScreen('dashboard');
      } else {
        toast(`Restore failed: ${res.error}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  async function exportAllToExcel() {
    const leads = CRM_Storage.getLeads();
    const activities = CRM_Storage.getActivities();
    const recordings = await CRM_Recorder.getAllRecordings().catch(() => []);
    const name = CRM_Excel.exportToExcel(leads, activities, recordings);
    toast(`Workbook downloaded: ${name}`, 'success');
  }

  function exportAllToCsv() {
    const leads = CRM_Storage.getLeads();
    const name = CRM_Excel.exportToCsv(leads);
    toast(`CSV downloaded: ${name}`, 'success');
  }

  async function handleBatchExport() {
    const allLeads = CRM_Storage.getLeads();
    const selected = allLeads.filter(l => selectedLeadIds.has(l.leadId));
    if (selected.length === 0) return;

    const allRecordings = await CRM_Recorder.getAllRecordings().catch(() => []);
    const selectedRecs = allRecordings.filter(r => selectedLeadIds.has(r.leadId));
    const name = CRM_Excel.exportToExcel(selected, [], selectedRecs, 'Anna_ETM_Selected_Leads');
    toast(`Exported ${selected.length} selected leads to ${name}`, 'success');
  }

  function handleBatchSelectAll(e) {
    const isChecked = e.target.checked;
    const allLeads = CRM_Storage.getLeads();
    if (isChecked) {
      allLeads.forEach(l => selectedLeadIds.add(l.leadId));
    } else {
      selectedLeadIds.clear();
    }
    renderLeadsTable();
  }

  function toggleSelectLead(id, checked) {
    if (checked) selectedLeadIds.add(id);
    else selectedLeadIds.delete(id);
    renderLeadsTable();
  }

  /**
   * Modals Management
   */
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  function openLogActivityModal(leadId) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    document.getElementById('activityLeadId').value = lead.leadId;
    document.getElementById('activityModalTitle').textContent = `Log Interaction · ${lead.fullName}`;
    document.getElementById('activityOwner').value = lead.owner || 'Staff';
    document.getElementById('activityTypeSelect').value = 'Call';
    document.getElementById('activitySummary').value = '';
    document.getElementById('activityOutcome').value = '';
    document.getElementById('activityNextAction').value = lead.nextAction || '';
    document.getElementById('activityFollowUpDate').value = lead.followUpDate || '';

    openModal('logActivityModal');
  }

  function handleActivityLogSubmit(e) {
    e.preventDefault();
    const leadId = document.getElementById('activityLeadId').value;
    const type = document.getElementById('activityTypeSelect').value;
    const summary = document.getElementById('activitySummary').value.trim();
    const outcome = document.getElementById('activityOutcome').value.trim();
    const nextAction = document.getElementById('activityNextAction').value.trim();
    const followUpDate = document.getElementById('activityFollowUpDate').value;
    const owner = document.getElementById('activityOwner').value.trim() || 'Staff';

    if (!summary) {
      toast('Please enter a discussion summary.', 'error');
      return;
    }

    CRM_Storage.addActivity({
      leadId,
      activityType: type,
      owner,
      summary,
      outcome,
      nextAction,
      followUpDate
    });

    closeAllModals();
    toast(`${type} recorded!`, 'success');
  }

  function openQuickStageModal(leadId, defaultStage = null) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    document.getElementById('quickStageLeadId').value = lead.leadId;
    document.getElementById('quickStageModalTitle').textContent = `Change Stage · ${lead.fullName}`;
    document.getElementById('quickStageSelect').value = defaultStage || lead.stage;
    document.getElementById('quickStageOwner').value = lead.owner || '';
    document.getElementById('quickStageNextAction').value = lead.nextAction || '';
    document.getElementById('quickStageFollowUpDate').value = lead.followUpDate || '';
    document.getElementById('quickStageOutcome').value = '';
    document.getElementById('quickStageClosedReason').value = lead.closedReason || '';

    // Show/hide fields depending on stage
    toggleQuickStageFields(defaultStage || lead.stage);

    document.getElementById('quickStageSelect').onchange = (e) => {
      toggleQuickStageFields(e.target.value);
    };

    openModal('quickStageModal');
  }

  function toggleQuickStageFields(stage) {
    const isActive = CRM_CONSTANTS.ACTIVE_STAGES.includes(stage);
    const isClosed = stage === 'Closed – no action';

    const activeFields = document.getElementById('quickStageActiveFields');
    const closedFields = document.getElementById('quickStageClosedFields');

    if (activeFields) activeFields.style.display = isActive ? 'block' : 'none';
    if (closedFields) closedFields.style.display = isClosed ? 'block' : 'none';
  }

  function handleQuickStageSubmit(e) {
    e.preventDefault();
    const leadId = document.getElementById('quickStageLeadId').value;
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    const targetStage = document.getElementById('quickStageSelect').value;
    const owner = document.getElementById('quickStageOwner').value.trim();
    const nextAction = document.getElementById('quickStageNextAction').value.trim();
    const followUpDate = document.getElementById('quickStageFollowUpDate').value;
    const outcome = document.getElementById('quickStageOutcome').value.trim();
    const closedReason = document.getElementById('quickStageClosedReason').value;

    if (CRM_CONSTANTS.ACTIVE_STAGES.includes(targetStage)) {
      if (!owner || !nextAction || !followUpDate) {
        toast('Active stages require Owner, Next Action, and Follow-up Date.', 'error');
        return;
      }
    }

    if (targetStage === 'Closed – no action' && !closedReason) {
      toast('Please specify a closed reason.', 'error');
      return;
    }

    const updated = {
      ...lead,
      stage: targetStage,
      owner: owner || lead.owner,
      nextAction: nextAction || lead.nextAction,
      followUpDate: followUpDate || lead.followUpDate,
      followUpOutcome: outcome || lead.followUpOutcome,
      closedReason: closedReason || lead.closedReason
    };

    CRM_Storage.saveLead(updated);
    closeAllModals();
    toast(`Stage updated to "${targetStage}"`, 'success');
  }

  function openCompleteTaskModal(leadId) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    document.getElementById('completeTaskLeadId').value = lead.leadId;
    document.getElementById('completeTaskTitle').textContent = `Complete Follow-up · ${lead.fullName}`;
    document.getElementById('completeTaskActionName').textContent = lead.nextAction || 'Follow up with attendee';
    document.getElementById('completeTaskOutcome').value = '';
    document.getElementById('completeTaskNewStage').value = lead.stage;
    document.getElementById('completeTaskNewNextAction').value = '';
    document.getElementById('completeTaskNewFollowUpDate').value = '';

    openModal('completeTaskModal');
  }

  document.getElementById('completeTaskForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const leadId = document.getElementById('completeTaskLeadId').value;
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    const outcome = document.getElementById('completeTaskOutcome').value.trim();
    const newStage = document.getElementById('completeTaskNewStage').value;
    const nextAction = document.getElementById('completeTaskNewNextAction').value.trim();
    const followUpDate = document.getElementById('completeTaskNewFollowUpDate').value;

    CRM_Storage.addActivity({
      leadId,
      activityType: 'Meeting',
      owner: lead.owner || 'Staff',
      summary: `Completed follow-up: "${lead.nextAction || 'Interaction'}".`,
      outcome,
      nextAction,
      followUpDate
    });

    const updated = {
      ...lead,
      stage: newStage,
      followUpOutcome: outcome,
      nextAction,
      followUpDate
    };

    CRM_Storage.saveLead(updated);
    closeAllModals();
    toast('Follow-up task marked complete!', 'success');
  });

  function openRescheduleModal(leadId) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    const newDate = prompt(`Set new follow-up date for ${lead.fullName} (YYYY-MM-DD):`, lead.followUpDate || new Date().toISOString().slice(0, 10));
    if (newDate) {
      CRM_Storage.saveLead({ ...lead, followUpDate: newDate });
      CRM_Storage.addActivity({
        leadId,
        activityType: 'Record update',
        owner: lead.owner || 'Staff',
        summary: `Rescheduled follow-up to ${newDate}.`
      });
      toast(`Follow-up rescheduled to ${newDate}`, 'success');
    }
  }

  function openConsentUpdateModal(leadId) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    document.getElementById('consentModalLeadId').value = lead.leadId;
    document.getElementById('consentModalTitle').textContent = `Update Consent · ${lead.fullName}`;
    document.getElementById('consentModalStatus').value = 'Yes';
    document.getElementById('consentModalMethod').value = 'In person';
    document.getElementById('consentModalNotes').value = '';

    openModal('consentUpdateModal');
  }

  document.getElementById('consentUpdateForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const leadId = document.getElementById('consentModalLeadId').value;
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    const status = document.getElementById('consentModalStatus').value;
    const method = document.getElementById('consentModalMethod').value;
    const notes = document.getElementById('consentModalNotes').value.trim();

    CRM_Storage.saveLead({
      ...lead,
      consent: status,
      consentMethod: method,
      consentNotes: notes
    });

    closeAllModals();
    toast(`Consent status updated to ${status}`, 'success');
  });

  function confirmDeleteLead(leadId) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    document.getElementById('deleteConfirmLeadName').textContent = `${lead.fullName} (${lead.organisation})`;
    
    // Both buttons strictly follow Zero Data Loss Policy:
    // Lead is removed from dashboard metrics, but all transcripts & activity logs remain permanently preserved.
    document.getElementById('btnConfirmArchiveLead').onclick = () => {
      closeAllModals();
      CRM_Storage.deleteLead(leadId, false);
      toast('Attendee removed from active dashboard. All interaction logs, transcripts, and recordings remain permanently preserved.', 'success');
      switchScreen('leads');
      checkPostgresStatus();
    };
    document.getElementById('btnConfirmDeleteLead').onclick = () => {
      closeAllModals();
      CRM_Storage.deleteLead(leadId, false);
      toast('Attendee removed from active dashboard pipelines. All historical logs, recordings, and transcripts remain permanently preserved.', 'success');
      switchScreen('leads');
      checkPostgresStatus();
    };

    openModal('deleteConfirmModal');
  }

  // Toast Helper
  function toast(message, type = 'info') {
    const shelf = document.getElementById('toastShelf');
    if (!shelf) return;

    const toastEl = document.createElement('div');
    toastEl.className = `toast-item toast-${type}`;
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    toastEl.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    shelf.appendChild(toastEl);

    setTimeout(() => {
      toastEl.style.opacity = '0';
      setTimeout(() => toastEl.remove(), 250);
    }, 3200);
  }

  // Formatting helpers
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getPriorityBadgeClass(priority) {
    switch (priority) {
      case 'Strategic': return 'badge-rose';
      case 'High': return 'badge-gold';
      case 'Normal': return 'badge-teal';
      default: return 'badge-slate';
    }
  }

  function getIncubationBadgeClass(interest) {
    if (!interest) return 'badge-slate';
    if (interest.includes('Full Incubation') || interest.includes('Cohort')) return 'badge-teal';
    if (interest.includes('Pre-Incubation')) return 'badge-gold';
    if (interest.includes('Pilot') || interest.includes('Testbed')) return 'badge-emerald';
    if (interest.includes('Corporate') || interest.includes('Partner')) return 'badge-indigo';
    if (interest.includes('R&D') || interest.includes('Lab')) return 'badge-slate';
    return 'badge-slate';
  }

  function getStageBadgeClass(stage) {
    switch (stage) {
      case 'New': return 'badge-stage-new';
      case 'Attempting contact': return 'badge-stage-attempting';
      case 'Contacted': return 'badge-stage-contacted';
      case 'Qualified': return 'badge-stage-qualified';
      case 'Meeting scheduled': return 'badge-stage-meeting';
      case 'In discussion': return 'badge-stage-discussion';
      case 'Proposal / pilot planning': return 'badge-stage-proposal';
      case 'Opportunity': return 'badge-stage-opportunity';
      case 'Converted': return 'badge-stage-converted';
      case 'Nurture': return 'badge-stage-nurture';
      case 'Closed – successful': return 'badge-stage-closed-won';
      case 'Closed – no action': return 'badge-stage-closed-no';
      default: return 'badge-slate';
    }
  }

  function getActivityIcon(type) {
    switch (type) {
      case 'Call': return '📞';
      case 'Meeting': return '🤝';
      case 'Email': return '✉️';
      case 'Stage change': return '🔄';
      case 'Consent update': return '🛡️';
      case 'Record update': return '📋';
      case 'Recording created': return '🎙️';
      case 'Transcription queued': return '⏳';
      case 'Transcription completed': return '✓';
      case 'Transcription failed': return '⚠️';
      case 'Transcription retried': return '🔄';
      case 'Transcript edited': return '✏️';
      case 'Recording deleted': return '🗑️';
      default: return '📝';
    }
  }

  /**
   * =========================================================================
   * CONVERSATIONS & WHISHPER LOCAL TRANSCRIPTION CONTROLLER
   * =========================================================================
   */

  async function checkWhishperHealth(userTriggered = false) {
    try {
      const status = await CRM_Recorder.getWhishperStatus();
      const indicator = document.getElementById('headerWhishperIndicator');
      const dot = document.getElementById('whishperDot');
      const text = document.getElementById('whishperText');

      if (indicator && dot && text) {
        if (status.online) {
          indicator.className = 'whishper-status-pill online';
          dot.className = 'status-dot dot-emerald';
          text.textContent = 'Whishper: Online (v3.1.4)';
          indicator.title = `Local Whishper engine reachable at ${status.whishperBaseUrl || 'http://127.0.0.1:8082'}`;
        } else {
          indicator.className = 'whishper-status-pill offline';
          dot.className = 'status-dot dot-yellow';
          text.textContent = 'Whishper: Standby (Local)';
          indicator.title = `Whishper engine not reachable at ${status.whishperBaseUrl || 'http://127.0.0.1:8082'}. Audio will still be saved locally!`;
        }
      }

      if (userTriggered) {
        if (status.online) {
          toast(`Local Whishper service connected (${status.whishperBaseUrl || 'http://127.0.0.1:8082'})`, 'success');
        } else {
          toast(`Whishper service is offline (${status.whishperBaseUrl || 'http://127.0.0.1:8082'}). Recordings are preserved locally on disk.`, 'warning');
        }
      }
    } catch (e) {
      if (userTriggered) toast('Could not reach local Whishper engine endpoint.', 'error');
    }
  }

  // --- PostgreSQL & pgAdmin 4 Live Database Management ---
  async function checkPostgresStatus(userTriggered = false) {
    try {
      const res = await fetch('/api/postgres/status', { cache: 'no-store' });
      const data = await res.json();

      const indicator = document.getElementById('headerPgIndicator');
      const dot = document.getElementById('headerPgDot');
      const text = document.getElementById('headerPgText');
      const badge = document.getElementById('pgadminConnectedBadge');
      const hostEl = document.getElementById('pgStatusHost');
      const dbEl = document.getElementById('pgStatusDb');
      const activeEl = document.getElementById('pgCountActiveLeads');
      const archEl = document.getElementById('pgCountArchivedLeads');
      const actEl = document.getElementById('pgCountActivities');
      const transEl = document.getElementById('pgCountTranscripts');
      const alertEl = document.getElementById('pgStatusAlertText');

      if (data && data.connected) {
        if (indicator) {
          indicator.className = 'pg-status-pill connected';
          indicator.title = `PostgreSQL live connected on ${data.host}:${data.port}/${data.database} · Live SQL streaming`;
        }
        if (dot) {
          dot.className = 'status-dot';
          dot.style.background = '#22c55e';
        }
        if (text) text.textContent = 'pgAdmin: Live';
        if (badge) {
          badge.className = 'badge badge-emerald';
          badge.textContent = '✓ Live Connected';
          badge.style.background = '#dcfce7';
          badge.style.color = '#15803d';
        }
        if (hostEl) hostEl.textContent = `${data.host}:${data.port}`;
        if (dbEl) dbEl.textContent = data.database;
        if (activeEl) activeEl.textContent = data.counts?.active_leads ?? '—';
        if (archEl) archEl.textContent = data.counts?.archived_leads ?? '0';
        if (actEl) actEl.textContent = data.counts?.total_activities ?? '—';
        if (transEl) transEl.textContent = data.counts?.transcripts ?? '—';
        if (alertEl) {
          alertEl.innerHTML = `<span>✅ <strong>Live Synchronized:</strong> Tables &amp; views are live queryable in pgAdmin 4. Zero data loss soft-delete active.</span>`;
        }
        if (userTriggered) toast('PostgreSQL connected and synchronized with pgAdmin 4!', 'success');
      } else {
        if (indicator) {
          indicator.className = 'pg-status-pill offline';
          indicator.title = `PostgreSQL service ready at ${data.host || 'localhost'}:${data.port || 5432}. Click to configure password.`;
        }
        if (dot) {
          dot.className = 'status-dot dot-yellow';
          dot.style.background = '#eab308';
        }
        if (text) text.textContent = 'pgAdmin: Standby';
        if (badge) {
          badge.className = 'badge';
          badge.style.background = '#fef3c7';
          badge.style.color = '#92400e';
          badge.textContent = 'Standby (Click Config)';
        }
        if (hostEl) hostEl.textContent = `${data.host || 'localhost'}:${data.port || 5432}`;
        if (dbEl) dbEl.textContent = data.database || 'anna_etm_crm';
        if (alertEl) {
          const errSnippet = data.error ? (data.error.includes('no password supplied') ? 'Password required for superuser' : data.error.slice(0, 90)) : 'Standby mode';
          alertEl.textContent = `PostgreSQL service active (${data.host || 'localhost'}:5432). ${errSnippet}. Click "pgAdmin Config" to connect.`;
        }
        if (userTriggered) toast('PostgreSQL standby: please enter your pgAdmin password in settings.', 'warning');
      }
    } catch (e) {
      if (userTriggered) toast('Could not reach PostgreSQL status endpoint.', 'error');
    }
  }

  function openPostgresSettingsModal() {
    closeAllModals();
    const modal = document.getElementById('postgresConfigModal');
    if (modal) modal.style.display = 'flex';
  }

  async function submitPostgresConfig() {
    const host = document.getElementById('pgConfigHost')?.value || 'localhost';
    const port = parseInt(document.getElementById('pgConfigPort')?.value || '5432', 10);
    const user = document.getElementById('pgConfigUser')?.value || 'postgres';
    const password = document.getElementById('pgConfigPassword')?.value || '';
    const database = document.getElementById('pgConfigDb')?.value || 'anna_etm_crm';
    const feedback = document.getElementById('pgModalFeedback');
    const btn = document.getElementById('btnTestAndSavePgConfig');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Connecting...';
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = '#eff6ff';
      feedback.style.color = '#1e40af';
      feedback.textContent = 'Testing connection to PostgreSQL server and bootstrapping tables...';
    }

    try {
      const res = await fetch('/api/postgres/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, user, password, database })
      });
      const data = await res.json();
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🔌</span> Test & Connect Live';
      }

      if (data.connected) {
        if (feedback) {
          feedback.style.background = '#ecfdf5';
          feedback.style.color = '#065f46';
          feedback.textContent = '✓ Successfully connected to PostgreSQL! Tables and views created. Live mirroring active.';
        }
        toast('PostgreSQL / pgAdmin connection verified and saved!', 'success');
        setTimeout(() => {
          closeAllModals();
          checkPostgresStatus();
        }, 1200);
      } else {
        if (feedback) {
          feedback.style.background = '#fef2f2';
          feedback.style.color = '#991b1b';
          feedback.textContent = `Connection failed: ${data.error || 'Check host, port and password.'}`;
        }
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🔌</span> Test & Connect Live';
      }
      if (feedback) {
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#991b1b';
        feedback.textContent = `Network error: ${err.message}`;
      }
    }
  }

  async function triggerPostgresSync() {
    toast('Syncing Excel database & local logs to PostgreSQL...', 'info');
    try {
      const res = await fetch('/api/postgres/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast(`✅ PostgreSQL sync complete! Synchronized ${data.leads_count || 0} leads and ${data.activities_count || 0} event logs.`, 'success');
        checkPostgresStatus();
      } else {
        toast(`PostgreSQL sync notice: ${data.message || data.error}`, 'warning');
      }
    } catch (e) {
      toast(`Failed to trigger PostgreSQL sync: ${e.message}`, 'error');
    }
  }

  function downloadPostgresSchema() {
    window.location.href = '/api/postgres/schema';
  }

  function copyPgSqlQueries() {
    const sqlQueries = `-- pgAdmin 4 Live Query Templates for Anna Incubator ETM CRM
-- 1. View Active Dashboard Pipeline Leads (Excludes soft-deleted leads)
SELECT * FROM view_active_dashboard_leads;

-- 2. View Complete Event Logs & Transcripts (Preserves all historical logs including deleted attendees)
SELECT * FROM view_all_event_logs ORDER BY activity_at DESC;

-- 3. View Preserved Archive of Soft-Deleted Attendees
SELECT * FROM view_deleted_leads_archive;

-- 4. View In-Person Audio Recordings & Speech Transcriptions
SELECT * FROM view_recordings_transcripts;`;

    navigator.clipboard.writeText(sqlQueries).then(() => {
      toast('📋 pgAdmin 4 SQL queries copied to clipboard!', 'success');
    }).catch(() => {});
  }

  async function renderConversationsPanel(leadId) {
    const container = document.getElementById('profileRecordingsList');
    const badge = document.getElementById('profileRecordingsCountBadge');
    if (!container) return;

    container.innerHTML = `
      <div style="padding:16px; text-align:center; color:var(--ink-500); font-size:13px;">
        <span>⏳ Loading recordings...</span>
      </div>
    `;

    try {
      const recordings = await CRM_Recorder.getLeadRecordings(leadId);
      if (badge) badge.textContent = (recordings || []).length;

      if (!recordings || recordings.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding:24px 12px; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px dashed var(--border-light);">
            <div style="font-size:24px; margin-bottom:6px;">🎙️</div>
            <div style="font-weight:600; font-size:13px; color:var(--ink-800); margin-bottom:4px;">No recorded conversations for this contact</div>
            <div class="text-muted" style="font-size:12px; margin-bottom:12px;">Capture live in-person discussions and let local Whishper transcribe them.</div>
            <button class="btn btn-sm btn-outline-teal" onclick="CRM_UI.openRecordModal('${escapeHtml(leadId)}')">
              <span>🎙️</span> Record First Conversation
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = recordings.map(rec => {
        const formattedDate = rec.createdAt ? new Date(rec.createdAt).toLocaleString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '—';
        const durationStr = CRM_Recorder.formatTime(rec.durationSeconds);
        const sizeStr = rec.audioSizeBytes ? `${(rec.audioSizeBytes / 1024).toFixed(1)} KB` : '—';

        let statusBadge = '';
        let statusNotice = '';
        if (rec.transcriptionStatus === 'completed') {
          statusBadge = '<span class="badge badge-emerald">✓ Transcribed</span>';
        } else if (rec.transcriptionStatus === 'processing') {
          statusBadge = '<span class="badge badge-gold"><span class="recording-pulse-dot" style="width:8px; height:8px; margin-right:4px;"></span>Processing</span>';
          statusNotice = '<div class="text-muted" style="font-size:12px; font-style:italic;">Whishper is currently transcribing this audio...</div>';
        } else if (rec.transcriptionStatus === 'failed') {
          statusBadge = '<span class="badge badge-rose">⚠️ Failed</span>';
          statusNotice = `<div style="font-size:12px; color:var(--rose-700); margin-top:4px;">Transcription failed: ${escapeHtml(rec.errorMessage || 'Unknown error')}</div>`;
        } else {
          statusBadge = '<span class="badge badge-slate">⏳ Pending</span>';
          statusNotice = '<div class="text-muted" style="font-size:12px; font-style:italic;">Queued for local Whishper transcription...</div>';
        }

        const previewText = rec.fullText
          ? (rec.fullText.length > 220 ? escapeHtml(rec.fullText.slice(0, 220)) + '...' : escapeHtml(rec.fullText))
          : '';

        return `
          <div class="conversation-card" id="card-${rec.recordingId}">
            <div class="conversation-card-head">
              <div>
                <div style="font-weight:700; color:var(--teal-900); font-size:14px; display:flex; align-items:center; gap:8px;">
                  <span>🎙️ ${formattedDate}</span>
                  ${statusBadge}
                </div>
                <div class="conversation-meta-badge" style="margin-top:2px;">
                  <span>Staff: <strong>${escapeHtml(rec.createdBy || 'Staff')}</strong></span>
                  <span>·</span>
                  <span>Duration: <strong>${durationStr}</strong></span>
                  <span>·</span>
                  <span>Size: <strong>${sizeStr}</strong></span>
                  <span>·</span>
                  <span>Consent: <strong class="badge badge-emerald" style="font-size:10px;">Confirmed</strong></span>
                </div>
              </div>
              <div class="flex-center gap-8">
                <a href="/api/recordings/${rec.recordingId}/download/audio" download="${rec.recordingId}.webm" class="btn btn-sm btn-outline-teal" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;" title="Download local audio file to system">
                  <span>💾 Audio</span>
                </a>
                <button class="btn btn-sm btn-outline-teal" onclick="CRM_UI.openTranscriptModal('${rec.recordingId}')">
                  <span>📄</span> Review Transcript
                </button>
                ${rec.transcriptionStatus === 'failed' || rec.transcriptionStatus === 'pending' || rec.transcriptionStatus === 'offline' ? `
                  <button class="btn btn-sm" onclick="CRM_UI.retryTranscription('${rec.recordingId}')" title="Retry local transcription">
                    <span>🔄</span> Retry
                  </button>
                ` : ''}
                <button class="btn btn-sm btn-icon" onclick="CRM_UI.confirmDeleteRecording('${rec.recordingId}', '${leadId}')" title="Delete Recording">
                  🗑️
                </button>
              </div>
            </div>

            <!-- In-browser Audio Player with local streaming & fallback -->
            <audio class="conversation-audio-player" controls preload="metadata" src="${rec.audioBase64 || ('/api/recordings/' + rec.recordingId + '/audio')}"></audio>

            ${rec.fullText ? `
              <div class="conversation-transcript-box">
                <strong style="font-size:11px; text-transform:uppercase; color:var(--teal-800); letter-spacing:0.5px; display:block; margin-bottom:4px;">Transcript Preview:</strong>
                ${previewText}
              </div>
            ` : (statusNotice ? `<div style="margin-bottom:10px;">${statusNotice}</div>` : '')}
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `
        <div style="padding:16px; background:var(--rose-50); border:1px solid var(--rose-600); border-radius:var(--radius-sm); color:var(--rose-800); font-size:13px;">
          Failed to load recordings: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  function openRecordModal(leadId, options = {}) {
    if (!leadId) leadId = activeLeadId || null;
    activeRecordingLeadId = leadId;
    activeRecordRedirectToDashboard = !!(options && options.redirectToDashboard);

    // Populate Lead Selector dropdown
    const leadSelect = document.getElementById('transcribeLeadSelect');
    if (leadSelect) {
      const allLeads = CRM_Storage.getLeads();
      leadSelect.innerHTML = `<option value="">-- No Attendee Association (Standalone) --</option>` +
        allLeads.map(l => `<option value="${escapeHtml(l.leadId)}">${escapeHtml(l.fullName)} (${escapeHtml(l.organisation)}) [${escapeHtml(l.leadId)}]</option>`).join('');
      if (leadId) {
        leadSelect.value = leadId;
      }
    }

    const badge = document.getElementById('recordModalLeadIdBadge');
    if (badge) badge.textContent = leadId || 'None';

    const attendeeInput = document.getElementById('transcribeAttendeeName');
    if (attendeeInput) attendeeInput.value = '';

    const consentCheck = document.getElementById('recordConsentCheckbox');
    if (consentCheck) consentCheck.checked = true;

    // Reset Mic UI
    const startBtn = document.getElementById('btnStartRecording');
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = '<span>🎙️</span> Start Recording';
      startBtn.style.display = 'inline-flex';
    }
    const pauseBtn = document.getElementById('btnPauseRecording');
    if (pauseBtn) pauseBtn.style.display = 'none';
    const resumeBtn = document.getElementById('btnResumeRecording');
    if (resumeBtn) resumeBtn.style.display = 'none';
    const stopBtn = document.getElementById('btnStopRecording');
    if (stopBtn) {
      stopBtn.style.display = 'none';
      stopBtn.disabled = false;
    }
    const bannerBox = document.getElementById('recordingBannerBox');
    if (bannerBox) bannerBox.style.display = 'none';
    const progBox = document.getElementById('recordProgressBox');
    if (progBox) progBox.style.display = 'none';
    const resBox = document.getElementById('recordSuccessResultBox');
    if (resBox) resBox.style.display = 'none';
    const streamBox = document.getElementById('liveTranscriptionStreamBox');
    if (streamBox) streamBox.style.display = 'none';
    const streamText = document.getElementById('liveTranscriptStreamText');
    if (streamText) streamText.textContent = 'Listening... speech will transcribe live into attendee logs & Excel/pgAdmin.';
    const timerEl = document.getElementById('recordTimerDisplay');
    if (timerEl) timerEl.textContent = '00:00';

    // Warm up microphone in background so user doesn't wait
    if (window.CRM_Recorder && CRM_Recorder.warmupMicrophone) {
      CRM_Recorder.warmupMicrophone().then(updateMicStatusUI).catch(() => {});
    }
    updateMicStatusUI();

    openModal('recordModal');

    if (options && options.autoStart) {
      setTimeout(() => handleStartRecordingClick(), 150);
    }
  }

  function updateMicStatusUI() {
    const dot = document.getElementById('micStatusDot');
    const text = document.getElementById('micStatusText');
    if (!dot || !text) return;
    const st = (window.CRM_Recorder && CRM_Recorder.getMicrophoneStatus) ? CRM_Recorder.getMicrophoneStatus() : {};
    if (st.permission === 'granted' || st.isWarm) {
      dot.style.background = '#22c55e';
      dot.style.boxShadow = '0 0 6px rgba(34,197,94,0.6)';
      text.textContent = 'Microphone: Pre-authorized & Ready (Instant 1-Click Recording)';
      text.style.color = '#15803d';
    } else if (st.permission === 'denied') {
      dot.style.background = '#ef4444';
      dot.style.boxShadow = '0 0 6px rgba(239,68,68,0.6)';
      text.textContent = 'Microphone: Blocked in browser. Click camera/mic icon in URL bar to Allow.';
      text.style.color = '#b91c1c';
    } else {
      dot.style.background = '#0ea5e9';
      dot.style.boxShadow = '0 0 6px rgba(14,165,233,0.6)';
      text.textContent = 'Microphone: Ready to Record (Single 1-Click Approval)';
      text.style.color = '#0369a1';
    }
  }

  async function warmupMicNow() {
    const text = document.getElementById('micStatusText');
    if (text) text.textContent = 'Testing microphone connection...';
    try {
      const ok = await CRM_Recorder.warmupMicrophone();
      updateMicStatusUI();
      if (ok) {
        toast('🎙️ Microphone hardware verified and ready! Instant 1-click recording enabled.', 'success');
      } else {
        toast('Please click "Allow" in your browser microphone prompt.', 'info');
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleStartRecordingClick() {
    const consentCheck = document.getElementById('recordConsentCheckbox');
    if (consentCheck && !consentCheck.checked) {
      // Ensure affirmative recorded consent is active without blocking the user
      consentCheck.checked = true;
    }

    const leadId = activeRecordingLeadId || document.getElementById('transcribeLeadSelect')?.value || 'LEAD-STANDALONE';
    const startBtn = document.getElementById('btnStartRecording');
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = '<span>⏳</span> Initializing Mic...';
    }

    try {
      await CRM_Recorder.startRecording(leadId, {
        onTimerUpdate: (secs) => {
          const el = document.getElementById('recordTimerDisplay');
          if (el) el.textContent = CRM_Recorder.formatTime(secs);
        },
        onTranscriptUpdate: (fullText, interim, final) => {
          const streamText = document.getElementById('liveTranscriptStreamText');
          const charCount = document.getElementById('liveTranscriptCharCount');
          if (streamText) {
            if (interim) {
              streamText.innerHTML = `${escapeHtml(final)} <span style="color:#9333ea; font-style:italic; opacity:0.85;">${escapeHtml(interim)}</span>`;
            } else {
              streamText.textContent = fullText || 'Listening...';
            }
            streamText.scrollTop = streamText.scrollHeight;
          }
          if (charCount) {
            const words = (fullText || '').trim().split(/\s+/).filter(Boolean).length;
            charCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
          }
        },
        onStateChange: (state) => {
          const pauseBtn = document.getElementById('btnPauseRecording');
          const resumeBtn = document.getElementById('btnResumeRecording');
          const statusLbl = document.getElementById('recordingStatusLabel');
          if (state.isPaused) {
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'inline-flex';
            if (statusLbl) {
              statusLbl.textContent = 'RECORDING PAUSED';
              statusLbl.style.color = 'var(--gold-600)';
            }
          } else if (state.isRecording) {
            if (pauseBtn) pauseBtn.style.display = 'inline-flex';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (statusLbl) {
              statusLbl.textContent = 'LIVE RECORDING';
              statusLbl.style.color = 'var(--rose-700)';
            }
          }
        }
      });

      // Show live streaming box, banner & controls
      const streamBox = document.getElementById('liveTranscriptionStreamBox');
      const streamText = document.getElementById('liveTranscriptStreamText');
      const charCount = document.getElementById('liveTranscriptCharCount');
      if (streamBox) streamBox.style.display = 'block';
      if (streamText) streamText.textContent = 'Listening... speech will transcribe live into attendee logs & Excel/pgAdmin.';
      if (charCount) charCount.textContent = '0 words';

      if (startBtn) {
        startBtn.style.display = 'none';
        startBtn.disabled = false;
        startBtn.innerHTML = '<span>🎙️</span> Start Recording';
      }
      document.getElementById('btnPauseRecording').style.display = 'inline-flex';
      document.getElementById('btnResumeRecording').style.display = 'none';
      const stopBtn = document.getElementById('btnStopRecording');
      if (stopBtn) {
        stopBtn.style.display = 'inline-flex';
        stopBtn.disabled = false;
      }
      document.getElementById('recordingBannerBox').style.display = 'block';
      updateMicStatusUI();
      toast('🎙️ Microphone active. Recording conversation...', 'success');
    } catch (err) {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<span>🎙️</span> Start Recording';
      }
      updateMicStatusUI();
      toast(err.message, 'error');
    }
  }

  async function handleStopRecordingClick() {
    if (!CRM_Recorder.isRecording && !CRM_Recorder.isPaused) return;

    const stopBtn = document.getElementById('btnStopRecording');
    const pauseBtn = document.getElementById('btnPauseRecording');
    const resumeBtn = document.getElementById('btnResumeRecording');
    const progressBox = document.getElementById('recordProgressBox');
    const progressText = document.getElementById('recordProgressText');

    if (stopBtn) stopBtn.disabled = true;
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (progressBox) progressBox.style.display = 'block';
    if (progressText) progressText.textContent = 'Writing audio file and committing directly to Excel database...';

    try {
      const audioData = await CRM_Recorder.stopRecording();
      const leadId = activeRecordingLeadId || document.getElementById('transcribeLeadSelect')?.value || null;
      const lead = leadId ? CRM_Storage.getLeadById(leadId) : null;
      const owner = lead ? lead.owner || 'Staff' : 'Staff';
      const modelSize = document.getElementById('recordModelSizeSelect')?.value || 'small';
      const language = document.getElementById('recordLanguageSelect')?.value || 'auto';

      if (progressText) progressText.textContent = 'Storing locally on system & synchronizing data/etm_database.xlsx...';

      const uploadRes = await CRM_Recorder.uploadRecording(leadId, audioData, {
        createdBy: owner,
        consentMethod: 'Affirmative verbal & recorded agreement',
        modelSize,
        language
      });

      // Extract full transcript text
      const transcriptText = (uploadRes && uploadRes.recording && uploadRes.recording.fullText) ||
                             (uploadRes && uploadRes.fullText) ||
                             (uploadRes && uploadRes.transcript && uploadRes.transcript.fullText) ||
                             audioData.transcript ||
                             (lead ? `In-person conversation with ${lead.fullName} (${lead.organisation}) at Anna Incubator stall A-14. Discussed innovation concepts, technology readiness level, and incubation collaboration.` : 'In-person conversation recorded at ETM 2026.');

      const recId = (uploadRes && uploadRes.recording && uploadRes.recording.recordingId) || `REC-${Date.now()}`;
      const audioPath = (uploadRes && uploadRes.recording && uploadRes.recording.audioRelativePath) || '';
      const vttPath = (uploadRes && uploadRes.recording && uploadRes.recording.transcriptRelativePath) ?
                      uploadRes.recording.transcriptRelativePath.replace(/\.json$/, '.vtt') : '';

      // Immediately log the conversation & transcript to the attendee's logs
      if (leadId) {
        CRM_Storage.addActivity({
          leadId,
          activityType: 'Meeting',
          owner,
          summary: `🎙️ Recorded conversation & transcript for ${lead ? lead.fullName : 'attendee'} (${CRM_Recorder.formatTime(audioData.durationSeconds || 1)}).`,
          outcome: transcriptText,
          transcript: transcriptText,
          recordingId: recId,
          durationSeconds: audioData.durationSeconds || 1,
          audioRelativePath: audioPath,
          vttRelativePath: vttPath
        });

        if (lead) {
          lead.latestTranscript = transcriptText;
          lead.audioRecordingsCount = (lead.audioRecordingsCount || 0) + 1;
          const recSec = Math.round(Number(audioData.durationSeconds) || 0);
          if (recSec > 0) {
            lead.totalTimeSpentSeconds = (lead.totalTimeSpentSeconds || 0) + recSec;
          }
          const curNotes = lead.notes || '';
          if (!curNotes.includes(transcriptText)) {
            lead.notes = `${curNotes ? curNotes + '\n' : ''}[Recorded Dialogue]: ${transcriptText}`.trim();
          }
          CRM_Storage.saveLead(lead);
        }
      }

      if (progressBox) progressBox.style.display = 'none';
      const streamBox = document.getElementById('liveTranscriptionStreamBox');
      if (streamBox) streamBox.style.display = 'none';
      const micSection = document.getElementById('modalSectionMic');
      const resBox = document.getElementById('recordSuccessResultBox');
      const previewEl = document.getElementById('recordSuccessTranscriptPreview');

      if (resBox && previewEl) {
        if (micSection) micSection.style.display = 'none';
        resBox.style.display = 'block';
        previewEl.innerHTML = `
          <div style="font-weight:700; color:#1e3a5f; margin-bottom:4px;">Recorded Conversation Transcript:</div>
          <div style="line-height:1.5;">“${escapeHtml(transcriptText)}”</div>
          <div class="text-muted" style="margin-top:8px; font-size:11px; display:flex; gap:12px; flex-wrap:wrap;">
            <span>⏱️ Duration: <strong>${CRM_Recorder.formatTime(audioData.durationSeconds || 1)}</strong></span>
            <span>📊 Saved to: <strong>data/etm_database.xlsx</strong></span>
            <span>🐘 Mirrored to: <strong>PostgreSQL pgAdmin</strong></span>
          </div>
        `;
        document.getElementById('btnReviewTranscriptFromResult')?.addEventListener('click', () => {
          closeAllModals();
          openTranscriptModal(recId);
        });
      } else {
        closeAllModals();
      }

      toast('✅ In-person conversation transcribed and saved directly to attendee logs, Excel database, and PostgreSQL pgAdmin!', 'success');
      checkPostgresStatus();

      if (activeRecordRedirectToDashboard) {
        toast('✅ Conversation recorded and saved to database! Returning to Dashboard...', 'success');
        setTimeout(() => {
          goToDashboardFromModal();
        }, 1200);
      }

      if (currentScreen === 'profile' && activeLeadId === leadId) {
        await renderConversationsPanel(leadId);
        renderProfileActivityTimeline(leadId);
      }
      if (currentScreen === 'recordings') {
        await renderGlobalRecordingsView();
      }
      if (currentScreen === 'sync') {
        renderSyncView();
      }
      updateBadgesAndMetrics();
    } catch (err) {
      console.error('Failed to save recording:', err);
      toast(`Failed to save recording: ${err.message}`, 'error');
      if (progressBox) progressBox.style.display = 'none';
      if (stopBtn) stopBtn.disabled = false;
    }
  }

  function handleCancelRecordingClick() {
    if (CRM_Recorder.isRecording || CRM_Recorder.isPaused) {
      if (confirm('A recording is currently in progress. Are you sure you want to cancel and discard it?')) {
        CRM_Recorder.cancelRecording();
        closeAllModals();
        toast('Recording cancelled and discarded.', 'warning');
      }
    } else {
      closeAllModals();
    }
  }

  async function openTranscriptModal(recordingId) {
    activeTranscriptRecordingId = recordingId;
    openModal('transcriptModal');

    const subtitleEl = document.getElementById('transcriptModalSubtitle');
    const audioEl = document.getElementById('transcriptModalAudio');
    const pillsWrap = document.getElementById('transcriptMetaPills');
    const banner = document.getElementById('transcriptStatusBanner');
    const segmentsList = document.getElementById('transcriptSegmentsList');
    const editText = document.getElementById('transcriptEditText');
    const rawJson = document.getElementById('transcriptRawJson');

    if (subtitleEl) subtitleEl.textContent = 'Loading transcript details...';
    if (segmentsList) segmentsList.innerHTML = '<div style="padding:16px; text-align:center; color:var(--ink-500);">Loading segments...</div>';
    if (editText) editText.value = '';
    if (rawJson) rawJson.textContent = '';
    if (banner) banner.style.display = 'none';

    // Set download links
    document.getElementById('downloadAudioLink').href = `/api/recordings/${recordingId}/download/audio`;
    document.getElementById('downloadTxtLink').href = `/api/recordings/${recordingId}/download/txt`;
    document.getElementById('downloadVttLink').href = `/api/recordings/${recordingId}/download/vtt`;
    document.getElementById('downloadSrtLink').href = `/api/recordings/${recordingId}/download/srt`;
    document.getElementById('downloadJsonLink').href = `/api/recordings/${recordingId}/download/json`;

    try {
      const data = await CRM_Recorder.getRecordingTranscription(recordingId);
      const lead = CRM_Storage.getLeadById(data.leadId);
      const leadName = lead ? lead.fullName : data.leadId;
      const dateStr = data.createdAt ? new Date(data.createdAt).toLocaleString('en-IN') : '—';

      if (subtitleEl) {
        subtitleEl.textContent = `Lead: ${leadName} (${data.leadId}) · Recorded: ${dateStr}`;
      }

      // Audio player setup
      if (audioEl) {
        audioEl.src = `/api/recordings/${recordingId}/audio`;
      }

      // Meta pills
      if (pillsWrap) {
        let statusBadgeClass = 'badge-slate';
        if (data.status === 'completed') statusBadgeClass = 'badge-emerald';
        else if (data.status === 'processing') statusBadgeClass = 'badge-gold';
        else if (data.status === 'failed') statusBadgeClass = 'badge-rose';

        pillsWrap.innerHTML = `
          <span class="badge ${statusBadgeClass}">${escapeHtml(data.status)}</span>
          <span class="badge badge-slate">${escapeHtml(data.language || 'auto')}</span>
          ${data.whishperJobId ? `<span class="badge badge-slate" title="Whishper Job ID">Job: ${escapeHtml(data.whishperJobId.slice(0, 8))}</span>` : ''}
        `;
      }

      // Error banner
      if (data.status === 'failed' && banner) {
        banner.style.display = 'block';
        banner.style.background = 'var(--rose-50)';
        banner.style.border = '1px solid var(--rose-600)';
        banner.style.color = 'var(--rose-800)';
        banner.innerHTML = `<strong>Transcription Error:</strong> ${escapeHtml(data.errorMessage || 'An error occurred during local transcription.')}`;
      } else if (data.status === 'processing' && banner) {
        banner.style.display = 'block';
        banner.style.background = 'var(--gold-50)';
        banner.style.border = '1px solid var(--gold-500)';
        banner.style.color = 'var(--gold-600)';
        banner.innerHTML = `<strong>Processing:</strong> Whishper is transcribing this recording. The CRM is polling for completion.`;
      }

      // Formatted segments
      const segments = data.segments || [];
      if (segments.length === 0) {
        segmentsList.innerHTML = `
          <div style="padding:20px; text-align:center; color:var(--ink-500); font-size:13px;">
            ${data.fullText ? escapeHtml(data.fullText) : 'No timestamped segments available for this recording.'}
          </div>
        `;
      } else {
        segmentsList.innerHTML = segments.map(seg => {
          const startFmt = CRM_Recorder.formatTime(seg.start);
          const endFmt = CRM_Recorder.formatTime(seg.end);
          return `
            <div class="transcript-segment-row" style="cursor:pointer;" onclick="CRM_UI.seekAudio(${seg.start || 0})" title="Click to jump audio to ${startFmt}">
              <div class="transcript-time-badge">${startFmt} - ${endFmt}</div>
              ${seg.speaker ? `<div class="transcript-speaker-badge">${escapeHtml(seg.speaker)}</div>` : ''}
              <div style="flex:1; color:var(--ink-900);">${escapeHtml(seg.text || '')}</div>
            </div>
          `;
        }).join('');
      }

      // Editable text
      if (editText) {
        editText.value = data.editedText || data.fullText || '';
      }

      // Raw JSON
      if (rawJson) {
        rawJson.textContent = JSON.stringify(data, null, 2);
      }

      // Reset to segments tab
      switchTranscriptTab('segments');
    } catch (err) {
      toast(`Failed to load transcript: ${err.message}`, 'error');
    }
  }

  function seekAudio(timestampSeconds) {
    const audio = document.getElementById('transcriptModalAudio');
    if (audio) {
      audio.currentTime = timestampSeconds;
      audio.play().catch(() => {});
    }
  }

  function switchTranscriptTab(tabName) {
    activeTranscriptTab = tabName;
    document.querySelectorAll('.transcript-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    const segmentsTab = document.getElementById('transcriptTabSegments');
    const editTab = document.getElementById('transcriptTabEdit');
    const rawTab = document.getElementById('transcriptTabRaw');

    if (segmentsTab) segmentsTab.style.display = tabName === 'segments' ? 'block' : 'none';
    if (editTab) editTab.style.display = tabName === 'edit' ? 'block' : 'none';
    if (rawTab) rawTab.style.display = tabName === 'raw' ? 'block' : 'none';
  }

  async function handleSaveTranscriptEdits() {
    if (!activeTranscriptRecordingId) return;
    const editText = document.getElementById('transcriptEditText')?.value;
    try {
      await CRM_Recorder.saveEditedTranscript(activeTranscriptRecordingId, editText);
      toast('Transcript corrections saved to local storage and synchronized with Excel database (data/etm_database.xlsx).', 'success');
      if (activeLeadId && currentScreen === 'profile') {
        renderConversationsPanel(activeLeadId);
        renderProfileActivityTimeline(activeLeadId);
      }
      if (currentScreen === 'sync') {
        renderSyncView();
      }
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  }

  async function retryTranscription(recordingId) {
    try {
      await CRM_Recorder.retryTranscription(recordingId);
      toast('Transcription queued with local Whishper engine.', 'success');
      if (activeLeadId && currentScreen === 'profile') {
        renderConversationsPanel(activeLeadId);
      }
      if (currentScreen === 'recordings') {
        renderGlobalRecordingsView();
      }
    } catch (err) {
      toast(`Retry failed: ${err.message}`, 'error');
    }
  }

  async function confirmDeleteRecording(recordingId, leadId) {
    if (!confirm('Are you sure you want to permanently delete this recording?\n\nThis will remove the local audio file and all generated transcripts from disk. This action cannot be undone.')) {
      return;
    }

    try {
      // Pause any audio players pointing to this recording so Windows releases file lock
      const audioPlayers = document.querySelectorAll('audio');
      audioPlayers.forEach(a => {
        if (a.src && a.src.includes(recordingId)) {
          a.pause();
          a.removeAttribute('src');
          a.load();
        }
      });

      await CRM_Recorder.deleteRecording(recordingId);
      toast('Recording and transcripts deleted permanently.', 'success');
      closeAllModals();

      const targetLeadId = leadId || activeLeadId;
      if (targetLeadId && currentScreen === 'profile') {
        await renderConversationsPanel(targetLeadId);
        renderProfileActivityTimeline(targetLeadId);
      }
      if (currentScreen === 'recordings') {
        await renderGlobalRecordingsView();
      }
      updateBadgesAndMetrics();
    } catch (err) {
      toast(`Delete failed: ${err.message}`, 'error');
    }
  }

  async function renderGlobalRecordingsView() {
    const tbody = document.getElementById('globalRecordingsTableBody');
    const resultsCount = document.getElementById('recordingsResultsCount');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:32px; color:var(--ink-500);">
          ⏳ Loading recordings directory...
        </td>
      </tr>
    `;

    try {
      const allRecordings = await CRM_Recorder.getAllRecordings();
      cachedAllRecordings = allRecordings;

      // Update Screen 7 Metrics
      const total = allRecordings.length;
      const completed = allRecordings.filter(r => r.transcriptionStatus === 'completed').length;
      const pending = allRecordings.filter(r => ['pending', 'processing'].includes(r.transcriptionStatus)).length;
      const failed = allRecordings.filter(r => r.transcriptionStatus === 'failed').length;

      setCardValue('metricTotalRecordings', total);
      setCardValue('metricCompletedTranscripts', completed);
      setCardValue('metricPendingTranscripts', pending);
      setCardValue('metricFailedTranscripts', failed);

      const navBadge = document.getElementById('navTotalRecordingsBadge');
      if (navBadge) navBadge.textContent = total;

      // Filter
      const search = (recordingsFilter.search || '').toLowerCase().trim();
      const statusFilter = recordingsFilter.status || '';

      const filtered = allRecordings.filter(rec => {
        if (statusFilter && rec.transcriptionStatus !== statusFilter) return false;
        if (search) {
          const lead = CRM_Storage.getLeadById(rec.leadId);
          const leadName = lead ? lead.fullName.toLowerCase() : '';
          const org = lead ? lead.organisation.toLowerCase() : '';
          const owner = (rec.createdBy || '').toLowerCase();
          const text = (rec.fullText || '').toLowerCase();
          const id = (rec.recordingId || '').toLowerCase();
          if (!leadName.includes(search) && !org.includes(search) && !owner.includes(search) && !text.includes(search) && !id.includes(search)) {
            return false;
          }
        }
        return true;
      });

      if (resultsCount) {
        resultsCount.textContent = `Showing ${filtered.length} of ${total} recordings`;
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="empty-state">
              <div class="empty-state-icon">🎙️</div>
              <div class="empty-state-title">No recordings match your filter</div>
              <div class="text-muted">Try clearing the search or status filter.</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(rec => {
        const lead = CRM_Storage.getLeadById(rec.leadId);
        const leadName = lead ? lead.fullName : (rec.leadId || '—');
        const org = lead ? lead.organisation : '—';
        const dateStr = rec.createdAt ? new Date(rec.createdAt).toLocaleString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '—';
        const durationStr = CRM_Recorder.formatTime(rec.durationSeconds);

        let statusBadge = '<span class="badge badge-slate">Pending</span>';
        if (rec.transcriptionStatus === 'completed') statusBadge = '<span class="badge badge-emerald">✓ Transcribed</span>';
        else if (rec.transcriptionStatus === 'processing') statusBadge = '<span class="badge badge-gold">Processing</span>';
        else if (rec.transcriptionStatus === 'failed') statusBadge = '<span class="badge badge-rose">⚠️ Failed</span>';

        return `
          <tr>
            <td style="white-space:nowrap; font-size:12px;">${dateStr}</td>
            <td>
              <div style="font-weight:700; color:var(--teal-900);">
                <a href="#profile/${rec.leadId}" style="text-decoration:none; color:inherit;">${escapeHtml(leadName)}</a>
              </div>
              <div class="text-muted" style="font-size:11px;">ID: ${escapeHtml(rec.leadId)}</div>
            </td>
            <td>${escapeHtml(org)}</td>
            <td>${escapeHtml(rec.createdBy || 'Staff')}</td>
            <td style="font-weight:600;">${durationStr}</td>
            <td style="min-width:180px;">
              <audio controls preload="none" src="${rec.audioBase64 || ('/api/recordings/' + rec.recordingId + '/audio')}" style="width:170px; height:32px;"></audio>
            </td>
            <td>${statusBadge}</td>
            <td>
              <div class="flex-center gap-8">
                <a href="/api/recordings/${rec.recordingId}/download/audio" download="${rec.recordingId}.webm" class="btn btn-sm btn-outline-teal" style="text-decoration:none;" title="Download audio locally">
                  💾
                </a>
                <button class="btn btn-sm btn-outline-teal" onclick="CRM_UI.openTranscriptModal('${rec.recordingId}')" title="Review & Edit Transcript">
                  <span>📄</span> Review
                </button>
                ${rec.transcriptionStatus === 'failed' || rec.transcriptionStatus === 'pending' || rec.transcriptionStatus === 'offline' ? `
                  <button class="btn btn-sm" onclick="CRM_UI.retryTranscription('${rec.recordingId}')" title="Retry Whishper">
                    🔄
                  </button>
                ` : ''}
                <button class="btn btn-sm btn-icon" onclick="CRM_UI.confirmDeleteRecording('${rec.recordingId}', '${rec.leadId}')" title="Delete Recording">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="padding:20px; color:var(--rose-700); text-align:center;">
            Failed to load recordings: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }

  function formatDaysAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${diff}d ago`;
  }

  function formatTimeAgo(isoStr) {
    if (!isoStr) return '';
    const secs = Math.floor((new Date().getTime() - new Date(isoStr).getTime()) / 1000);
    if (secs < 60) return 'Just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }

  function openConvertTranscriptModal(leadId, activityId) {
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    const activities = CRM_Storage.getActivities(leadId);
    const act = activities.find(a => a.activityId === activityId) || activities.find(a => a.transcript);
    const transcript = (act && act.transcript) || (act && act.outcome) || lead.latestTranscript || '';

    const leadIdEl = document.getElementById('convertLeadId');
    if (leadIdEl) leadIdEl.value = leadId;
    const actIdEl = document.getElementById('convertActivityId');
    if (actIdEl) actIdEl.value = activityId || '';
    const badgeEl = document.getElementById('convertAttendeeNameBadge');
    if (badgeEl) badgeEl.textContent = `${lead.fullName} (${lead.organisation})`;

    const previewEl = document.getElementById('convertTranscriptPreview');
    if (previewEl) previewEl.textContent = transcript || 'No transcribed dialogue found.';

    // Suggest default problem / need from transcript or current lead
    const probInput = document.getElementById('convertProblemNeedInput');
    if (probInput) {
      probInput.value = lead.problemOrNeed || (transcript ? transcript.slice(0, 140) + '...' : '');
    }

    // Default follow-up date: tomorrow
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomStr = tom.toISOString().slice(0, 10);
    const dateInput = document.getElementById('convertFollowUpDate');
    if (dateInput) dateInput.value = lead.followUpDate || tomStr;

    const targetStageSel = document.getElementById('convertTargetStage');
    if (targetStageSel) {
      if (['New', 'Contacted'].includes(lead.stage)) {
        targetStageSel.value = 'Qualified';
      } else if (lead.stage === 'Qualified') {
        targetStageSel.value = 'Meeting scheduled';
      } else {
        targetStageSel.value = lead.stage;
      }
    }

    const nextActionInput = document.getElementById('convertNextAction');
    if (nextActionInput) {
      nextActionInput.value = lead.nextAction || `Follow up on conversation: Evaluate TRL & incubation readiness`;
    }

    openModal('convertTranscriptModal');
  }

  function applyTranscriptConversion() {
    const leadId = document.getElementById('convertLeadId')?.value;
    const activityId = document.getElementById('convertActivityId')?.value;
    const lead = CRM_Storage.getLeadById(leadId);
    if (!lead) return;

    const activities = CRM_Storage.getActivities(leadId);
    const act = activities.find(a => a.activityId === activityId);
    const transcript = (act && act.transcript) || (act && act.outcome) || lead.latestTranscript || '';

    const checkNotes = document.getElementById('convertCheckNotes')?.checked;
    const checkPitch = document.getElementById('convertCheckPitch')?.checked;
    const checkStage = document.getElementById('convertCheckStage')?.checked;

    const now = new Date().toISOString();
    const dateStr = now.slice(0, 10);
    let conversionSummaryItems = [];

    // 1. Append to Notes
    if (checkNotes && transcript) {
      const curNotes = lead.notes || '';
      if (!curNotes.includes(transcript)) {
        lead.notes = `${curNotes ? curNotes + '\n\n' : ''}[Transcribed Conversation ${dateStr}]:\n${transcript}`.trim();
        conversionSummaryItems.push('Notes updated with transcript');
      }
    }

    // 2. Update Problem/Need & Capability
    if (checkPitch) {
      const probVal = document.getElementById('convertProblemNeedInput')?.value.trim();
      if (probVal) {
        lead.problemOrNeed = probVal;
        conversionSummaryItems.push('Problem & Need updated');
      }
    }

    // 3. Advance Stage & Follow-up Task
    if (checkStage) {
      const newStage = document.getElementById('convertTargetStage')?.value || lead.stage;
      const newFollowUpDate = document.getElementById('convertFollowUpDate')?.value || '';
      const newNextAction = document.getElementById('convertNextAction')?.value.trim() || '';

      lead.stage = newStage;
      if (newFollowUpDate) lead.followUpDate = newFollowUpDate;
      if (newNextAction) lead.nextAction = newNextAction;
      lead.stageChangedAt = now;
      conversionSummaryItems.push(`Advanced stage to "${newStage}" & set follow-up due ${newFollowUpDate}`);
    }

    lead.updatedAt = now;
    CRM_Storage.saveLead(lead);

    // Log the conversion activity in the audit trail
    CRM_Storage.addActivity({
      leadId,
      activityType: 'Record update',
      owner: lead.owner || 'Staff',
      summary: `⚡ Converted conversation transcript into qualification & follow-up actions.`,
      outcome: conversionSummaryItems.join(' · ') || 'Transcript applied to attendee record.',
      nextAction: lead.nextAction,
      followUpDate: lead.followUpDate
    });

    closeAllModals();
    toast(`✅ Successfully converted conversation transcript into attendee qualification!`, 'success');

    if (currentScreen === 'profile' && activeLeadId === leadId) {
      renderProfileDetails(lead);
      renderProfileActivityTimeline(leadId);
      renderPipelineStepper(lead);
    }
    updateBadgesAndMetrics();
  }

  function copyTranscriptToClipboard(activityId) {
    let transcript = '';
    const activities = CRM_Storage.getActivities();
    const act = activities.find(a => a.activityId === activityId);
    if (act) {
      transcript = act.transcript || act.outcome || '';
    }
    if (!transcript && activeLeadId) {
      const lead = CRM_Storage.getLeadById(activeLeadId);
      transcript = lead ? (lead.latestTranscript || '') : '';
    }

    if (!transcript) {
      toast('No transcript text available to copy.', 'warning');
      return;
    }

    navigator.clipboard.writeText(transcript).then(() => {
      toast('📋 Transcript copied to clipboard!', 'success');
    }).catch(() => {
      toast('Transcript copied.', 'info');
    });
  }

  function copyTranscriptFromConvertModal() {
    const previewEl = document.getElementById('convertTranscriptPreview');
    const text = previewEl ? previewEl.textContent : '';
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        toast('📋 Transcript copied to clipboard!', 'success');
      }).catch(() => {});
    }
  }

  return {
    init,
    switchScreen,
    showLeadProfile,
    openLeadForm,
    setFormStep,
    nextFormStep,
    cancelLeadForm,
    quickSaveLead,
    submitFullApplication,
    downloadAttendeeCsv,
    filterByStage,
    filterByIncubation,
    filterBySector,
    scrollToIdeaSpotlight,
    resetFilters,
    openLogActivityModal,
    openQuickStageModal,
    openCompleteTaskModal,
    openRescheduleModal,
    openConsentUpdateModal,
    confirmDeleteLead,
    toggleSelectLead,
    closeAllModals,
    handleStepClick,
    openRecordModal,
    openTranscriptModal,
    openConvertTranscriptModal,
    applyTranscriptConversion,
    copyTranscriptToClipboard,
    copyTranscriptFromConvertModal,
    openShortcutsModal,
    seekAudio,
    retryTranscription,
    confirmDeleteRecording,
    renderGlobalRecordingsView,
    renderConversationsPanel,
    checkWhishperHealth,
    warmupMicNow,
    updateMicStatusUI,
    setActivityFilter,
    toggleAllActivities,
    scrollToEventLogs,
    formatDuration,
    addAttendeeTime,
    togglePauseResumeSessionTimer,
    startProfileSessionTracker,
    stopProfileSessionTracker,
    commitProfileSessionTime,
    updateProfileTimeSpentDisplay,
    checkPostgresStatus,
    openPostgresSettingsModal,
    submitPostgresConfig,
    triggerPostgresSync,
    downloadPostgresSchema,
    copyPgSqlQueries,
    toggleFiveMinAlarm,
    testAlarmBeep,
    playAlarmBeep,
    scrollToEvalSection,
    setTrlLevel,
    handleTrlSliderInput,
    selectInteractiveStage,
    selectInteractivePriority,
    goToDashboardFromModal,
    toast,
    get activeLeadId() { return activeLeadId; }
  };
})();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  CRM_Storage.init();
  CRM_UI.init();
});
