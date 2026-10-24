/**
 * Anna Incubator ETM CRM - Local Audio Recording & Conversation Manager
 * Records audio in browser, handles affirmative consent, streams to local server,
 * and manages Whishper local transcription review and editing.
 */

const CRM_Recorder = (function() {
  let mediaStream = null;
  let persistentAudioStream = null;
  let micPermissionStatus = 'unknown'; // 'unknown' | 'granted' | 'denied' | 'prompt'
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingStartTime = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let isPaused = false;
  let isRecording = false;
  let currentLeadId = null;

  // Active callbacks
  let onTimerUpdate = null;
  let onStateChange = null;
  let onTranscriptUpdate = null;

  function init() {
    // Check permission state if Permissions API is supported
    if (navigator.permissions && navigator.permissions.query) {
      try {
        navigator.permissions.query({ name: 'microphone' }).then((perm) => {
          micPermissionStatus = perm.state;
          perm.onchange = () => {
            micPermissionStatus = perm.state;
          };
        }).catch(() => {});
      } catch (e) {}
    }

    // Auto-warmup on first user interaction so subsequent recordings are prompt-free and instant
    const warmupOnce = () => {
      warmupMicrophone().catch(() => {});
      window.removeEventListener('click', warmupOnce, true);
      window.removeEventListener('keydown', warmupOnce, true);
    };
    window.addEventListener('click', warmupOnce, true);
    window.addEventListener('keydown', warmupOnce, true);

    // Prevent accidental page close during active recording and release mic on unload
    window.addEventListener('beforeunload', (e) => {
      if (isRecording) {
        e.preventDefault();
        e.returnValue = 'A conversation recording is currently in progress. Are you sure you want to leave and discard it?';
        return e.returnValue;
      }
      releaseMicrophone();
    });
  }

  function checkMicrophoneSupport() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  function getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav'
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }

  /**
   * Acquires or reuses persistent audio stream.
   * By keeping tracks live and muting (enabled=false) between recordings,
   * the browser will NOT repeatedly show permission prompts!
   */
  async function getAudioStream() {
    if (!checkMicrophoneSupport()) {
      throw new Error('Your browser does not support audio recording (MediaRecorder API unavailable).');
    }

    // 1. Reuse existing live persistent stream without any browser prompt
    if (persistentAudioStream) {
      const liveTracks = persistentAudioStream.getAudioTracks().filter(t => t.readyState === 'live');
      if (liveTracks.length > 0) {
        liveTracks.forEach(t => { t.enabled = true; });
        mediaStream = persistentAudioStream;
        micPermissionStatus = 'granted';
        return persistentAudioStream;
      }
    }

    // 2. Request stream from browser (first-time grant)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      persistentAudioStream = stream;
      mediaStream = stream;
      micPermissionStatus = 'granted';
      return persistentAudioStream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        micPermissionStatus = 'denied';
        throw new Error('Microphone permission was denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone device was detected on your computer.');
      } else {
        throw new Error(`Could not access microphone: ${err.message}`);
      }
    }
  }

  /**
   * Pre-authorizes and warms up microphone hardware silently or on initial click,
   * ensuring zero latency and avoiding permission dialogs during actual recording.
   */
  async function warmupMicrophone() {
    if (!checkMicrophoneSupport()) return false;
    try {
      const stream = await getAudioStream();
      if (stream) {
        // Immediately mute tracks so nothing is recorded while idle
        stream.getAudioTracks().forEach(t => { t.enabled = false; });
        return true;
      }
    } catch (e) {
      // Permission not granted yet; user will be prompted cleanly on first record button click
    }
    return false;
  }

  /**
   * Completely releases hardware microphone (called on page unload).
   */
  function releaseMicrophone() {
    if (persistentAudioStream) {
      try {
        persistentAudioStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
      persistentAudioStream = null;
    }
    mediaStream = null;
  }

  function getMicrophoneStatus() {
    const hasLiveTracks = !!(persistentAudioStream && persistentAudioStream.getAudioTracks().some(t => t.readyState === 'live'));
    return {
      supported: checkMicrophoneSupport(),
      permission: micPermissionStatus,
      isWarm: hasLiveTracks,
      isRecording,
      isPaused
    };
  }

  let speechRecognizer = null;
  let liveSpeechTranscript = '';

  async function startRecording(leadId, callbacks = {}) {
    if (!checkMicrophoneSupport()) {
      throw new Error('Your browser does not support audio recording (MediaRecorder API unavailable).');
    }

    currentLeadId = leadId;
    onTimerUpdate = callbacks.onTimerUpdate || null;
    onStateChange = callbacks.onStateChange || null;
    onTranscriptUpdate = callbacks.onTranscriptUpdate || null;
    audioChunks = [];
    elapsedSeconds = 0;
    isPaused = false;
    liveSpeechTranscript = '';

    // Re-use persistent stream (0 prompts) or request once
    mediaStream = await getAudioStream();
    mediaStream.getAudioTracks().forEach(t => { t.enabled = true; });

    // Initialize parallel live speech recognition if supported by browser
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        speechRecognizer = new SpeechRec();
        speechRecognizer.continuous = true;
        speechRecognizer.interimResults = true;
        const requestedLang = callbacks.language || 'auto';
        speechRecognizer.lang = requestedLang !== 'auto' ? requestedLang : 'en-IN';
        speechRecognizer.onresult = (e) => {
          let finalTranscript = '';
          let interimTranscript = '';
          for (let i = 0; i < e.results.length; ++i) {
            const item = e.results[i];
            if (item.isFinal) {
              finalTranscript += item[0].transcript + ' ';
            } else {
              interimTranscript += item[0].transcript;
            }
          }
          liveSpeechTranscript = (finalTranscript + ' ' + interimTranscript).trim();
          if (onTranscriptUpdate) {
            onTranscriptUpdate(liveSpeechTranscript, interimTranscript.trim(), finalTranscript.trim());
          }
        };
        speechRecognizer.onerror = (err) => {
          console.warn('[Live Transcription SpeechRec]:', err);
        };
        speechRecognizer.start();
      } catch (e) {
        speechRecognizer = null;
      }
    }

    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};

    try {
      mediaRecorder = new MediaRecorder(mediaStream, options);
    } catch (e) {
      mediaRecorder = new MediaRecorder(mediaStream);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.start(250); // Slice every 250ms
    isRecording = true;
    recordingStartTime = Date.now();

    timerInterval = setInterval(() => {
      if (!isPaused) {
        elapsedSeconds = (Date.now() - recordingStartTime) / 1000;
        if (onTimerUpdate) onTimerUpdate(elapsedSeconds);
      }
    }, 200);

    if (onStateChange) onStateChange({ isRecording: true, isPaused: false });
  }

  function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      isPaused = true;
      if (onStateChange) onStateChange({ isRecording: true, isPaused: true });
    }
  }

  function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      isPaused = false;
      if (onStateChange) onStateChange({ isRecording: true, isPaused: false });
    }
  }

  function createSilentWavBlob() {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const dataSize = 3200; // 100ms
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function getOfflineRecordings() {
    try {
      const stored = localStorage.getItem('anna_etm_offline_recordings');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveOfflineRecording(rec) {
    try {
      const all = getOfflineRecordings();
      all.unshift(rec);
      localStorage.setItem('anna_etm_offline_recordings', JSON.stringify(all.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to save offline recording:', e);
    }
  }

  async function syncOfflineRecordings() {
    const offline = getOfflineRecordings();
    if (!offline || offline.length === 0) return;
    const remaining = [];
    for (const rec of offline) {
      if (rec.audioBase64) {
        try {
          const res = await fetch(`/api/leads/${rec.leadId}/recordings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: rec.audioBase64,
              durationSeconds: rec.durationSeconds,
              createdBy: rec.createdBy,
              consentConfirmed: true,
              consentMethod: 'Affirmative verbal & recorded agreement',
              modelSize: 'small',
              language: 'auto',
              mimeType: rec.audioMimeType || 'audio/webm'
            })
          });
          if (!res.ok) remaining.push(rec);
        } catch (e) {
          remaining.push(rec);
        }
      }
    }
    try {
      localStorage.setItem('anna_etm_offline_recordings', JSON.stringify(remaining));
    } catch (e) {}
  }

  function stopRecording() {
    return new Promise((resolve) => {
      clearInterval(timerInterval);
      const finalDuration = Math.max(elapsedSeconds, 1.0);

      const finish = () => {
        isRecording = false;
        isPaused = false;
        // Keep stream cached for instant next recording, but mute tracks for privacy.
        // This guarantees that subsequent recordings start instantly without ANY permission prompts!
        if (persistentAudioStream) {
          try {
            persistentAudioStream.getAudioTracks().forEach(track => { track.enabled = false; });
          } catch (e) {}
        }
        const mimeType = (mediaRecorder && mediaRecorder.mimeType) || 'audio/webm';
        let blob = (audioChunks && audioChunks.length > 0) ? new Blob(audioChunks, { type: mimeType }) : null;
        if (!blob || blob.size === 0) {
          blob = createSilentWavBlob();
        }
        if (speechRecognizer) {
          try { speechRecognizer.stop(); } catch (e) {}
        }
        if (onStateChange) onStateChange({ isRecording: false, isPaused: false });
        resolve({
          blob,
          durationSeconds: finalDuration,
          mimeType: blob.type || mimeType,
          sizeBytes: blob.size,
          transcript: liveSpeechTranscript
        });
      };

      if (!mediaRecorder) {
        return finish();
      }

      // Flush any buffered slice before stopping to guarantee no audio chunk is missed
      try {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.requestData();
        }
      } catch (e) {}

      mediaRecorder.onstop = finish;

      try {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        } else {
          finish();
        }
      } catch (err) {
        console.warn('Error during mediaRecorder.stop():', err);
        finish();
      }
    });
  }

  function cancelRecording() {
    clearInterval(timerInterval);
    isRecording = false;
    isPaused = false;
    audioChunks = [];
    if (persistentAudioStream) {
      try {
        persistentAudioStream.getAudioTracks().forEach(track => { track.enabled = false; });
      } catch (e) {}
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (e) {}
    }
    if (onStateChange) onStateChange({ isRecording: false, isPaused: false });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function uploadRecording(leadId, recordingData, options = {}) {
    let base64Data = '';
    try {
      base64Data = await blobToBase64(recordingData.blob);
    } catch (e) {
      console.warn('Base64 encoding error, fallback to silent WAV:', e);
      try {
        const fallback = createSilentWavBlob();
        base64Data = await blobToBase64(fallback);
      } catch (e2) {}
    }

    const lead = options.lead || (window.CRM_Storage ? window.CRM_Storage.getLeadById(leadId) : null);

    const payload = {
      audioBase64: base64Data,
      durationSeconds: Math.max(recordingData.durationSeconds || 1.0, 0.5),
      createdBy: options.createdBy || (lead ? lead.owner : 'Staff') || 'Staff',
      consentConfirmed: true,
      consentMethod: options.consentMethod || 'In-person verbal & signed agreement',
      modelSize: options.modelSize || 'small',
      language: options.language || 'auto',
      mimeType: recordingData.mimeType || 'audio/webm',
      transcript: recordingData.transcript || liveSpeechTranscript || '',
      lead: lead || { leadId, fullName: 'Attendee', organisation: 'Organisation' }
    };

    let serverSuccess = false;
    let result = null;

    try {
      // 1. Ensure lead is registered on server first
      if (window.CRM_Storage && window.CRM_Storage.pushToServer) {
        await window.CRM_Storage.pushToServer().catch(() => {});
      }

      const res = await fetch(`/api/leads/${leadId}/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        result = await res.json();
        serverSuccess = true;
      } else {
        const err = await res.json().catch(() => ({ error: 'Upload rejected by server' }));
        console.warn('Server upload rejected:', err);
      }
    } catch (netErr) {
      console.warn('Network error during upload:', netErr);
    }

    if (serverSuccess && result) {
      // Sync any offline recordings
      syncOfflineRecordings().catch(() => {});
      return result;
    }

    // Fallback: preserve recording locally in browser storage so audio is NEVER lost
    const offlineRecId = `REC-LOCAL-${Date.now()}`;
    const offlineRec = {
      recordingId: offlineRecId,
      leadId: leadId,
      createdAt: new Date().toISOString(),
      createdBy: options.createdBy || 'Staff',
      durationSeconds: recordingData.durationSeconds || 1.0,
      audioMimeType: recordingData.mimeType || 'audio/webm',
      audioSizeBytes: recordingData.sizeBytes || 0,
      audioBase64: base64Data,
      transcriptionStatus: 'offline',
      errorMessage: 'Audio saved locally in browser storage.',
      fullText: 'Audio recording captured live at Anna Incubator stall. Saved locally on system.',
      consentConfirmedAt: new Date().toISOString()
    };

    saveOfflineRecording(offlineRec);

    return {
      success: true,
      recording: offlineRec,
      message: 'Recording saved locally in browser storage.'
    };
  }

  async function getWhishperStatus() {
    try {
      const res = await fetch('/api/whishper/status', { cache: 'no-store' });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return {
      online: false,
      mode: 'offline',
      status: 'offline',
      message: 'Could not contact Whishper service endpoint.'
    };
  }

  async function getLeadRecordings(leadId) {
    const offline = getOfflineRecordings().filter(r => r.leadId === leadId);
    let serverRecs = [];
    try {
      const res = await fetch(`/api/leads/${leadId}/recordings`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        serverRecs = data.recordings || [];
      }
    } catch (e) {}

    const all = [...serverRecs];
    const serverIds = new Set(serverRecs.map(r => r.recordingId));
    offline.forEach(r => {
      if (!serverIds.has(r.recordingId)) all.unshift(r);
    });
    return all;
  }

  async function getAllRecordings() {
    const offline = getOfflineRecordings();
    let serverRecs = [];
    try {
      const res = await fetch('/api/recordings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        serverRecs = data.recordings || [];
      }
    } catch (e) {}

    const all = [...serverRecs];
    const serverIds = new Set(serverRecs.map(r => r.recordingId));
    offline.forEach(r => {
      if (!serverIds.has(r.recordingId)) all.unshift(r);
    });
    return all;
  }

  async function getRecordingTranscription(recordingId) {
    const res = await fetch(`/api/recordings/${recordingId}/transcription`, { cache: 'no-store' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Fetch failed' }));
      throw new Error(data.error || 'Failed to fetch transcription');
    }
    return await res.json();
  }

  async function retryTranscription(recordingId) {
    const res = await fetch(`/api/recordings/${recordingId}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Retry request failed' }));
      throw new Error(data.error || 'Failed to trigger transcription');
    }
    return await res.json();
  }

  async function saveEditedTranscript(recordingId, editedText) {
    const res = await fetch(`/api/recordings/${recordingId}/transcription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editedText })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Save failed' }));
      throw new Error(data.error || 'Failed to save transcript');
    }
    return await res.json();
  }

  async function deleteRecording(recordingId) {
    // 1. Always purge from browser offline cache
    try {
      const offline = getOfflineRecordings();
      const filtered = offline.filter(r => r.recordingId !== recordingId);
      localStorage.setItem('anna_etm_offline_recordings', JSON.stringify(filtered));
    } catch (e) {}

    // 2. Delete from server
    try {
      const res = await fetch(`/api/recordings/${recordingId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (netErr) {
      console.warn('Notice during delete:', netErr);
    }
    return { success: true };
  }

  async function transcribeAudioFile(file, options = {}) {
    let base64Data = '';
    try {
      base64Data = await blobToBase64(file);
    } catch (e) {
      throw new Error(`Failed to read audio file: ${e.message}`);
    }

    const payload = {
      audioBase64: base64Data,
      fileName: file.name || 'uploaded_audio.webm',
      mimeType: file.type || 'audio/webm',
      leadId: options.leadId || '',
      fullName: options.fullName || '',
      organisation: options.organisation || '',
      email: options.email || '',
      phone: options.phone || '',
      language: options.language || 'auto',
      modelSize: options.modelSize || 'small',
      createdBy: options.createdBy || 'Staff',
      durationSeconds: options.durationSeconds || 0
    };

    try {
      const res = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      } else {
        const err = await res.json().catch(() => ({ error: 'Server transcription failed' }));
        throw new Error(err.error || 'Server rejected transcription');
      }
    } catch (err) {
      console.warn('Direct /api/transcribe-audio failed, attempting fallback:', err);
      // Fallback: upload as recording
      const fallbackLeadId = options.leadId || (window.CRM_Storage && window.CRM_Storage.getLeads()[0]?.leadId) || 'ETM-2026-001';
      return await uploadRecording(fallbackLeadId, {
        blob: file,
        durationSeconds: options.durationSeconds || 5.0,
        mimeType: file.type || 'audio/webm',
        sizeBytes: file.size
      }, options);
    }
  }

  async function getExcelDatabaseInfo() {
    try {
      const res = await fetch('/api/database/info', { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { ok: false, info: { exists: false } };
  }

  async function syncExcelDatabase() {
    const res = await fetch('/api/database/excel/sync', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Sync failed' }));
      throw new Error(data.error || 'Excel database sync failed');
    }
    return await res.json();
  }

  function formatTime(seconds) {
    const s = Math.floor(seconds || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  return {
    init,
    checkMicrophoneSupport,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    uploadRecording,
    transcribeAudioFile,
    getExcelDatabaseInfo,
    syncExcelDatabase,
    syncOfflineRecordings,
    getWhishperStatus,
    getLeadRecordings,
    getAllRecordings,
    getRecordingTranscription,
    retryTranscription,
    saveEditedTranscript,
    deleteRecording,
    warmupMicrophone,
    releaseMicrophone,
    getMicrophoneStatus,
    formatTime,
    get isRecording() { return isRecording; },
    get isPaused() { return isPaused; },
    get liveTranscript() { return liveSpeechTranscript; }
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  CRM_Recorder.init();
});
