const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { defaultClient: whishperClient } = require('./whishper_client.js');

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const dataDir = path.resolve(process.env.ETM_DATA_DIR || path.join(root, 'data'));

const leadsFile = path.join(dataDir, 'leads.json');
const leadsBak = path.join(dataDir, 'leads.bak.json');
const activitiesFile = path.join(dataDir, 'activities.json');
const activitiesBak = path.join(dataDir, 'activities.bak.json');
const recordingsFile = path.join(dataDir, 'recordings.json');
const recordingsBak = path.join(dataDir, 'recordings.bak.json');

const recordingsDir = path.join(dataDir, 'recordings');
const transcriptsDir = path.join(dataDir, 'transcripts');
const backupsDir = path.join(dataDir, 'backups');

[dataDir, recordingsDir, transcriptsDir, backupsDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.webm': 'audio/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8',
};

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
  });
  res.end(body);
}

function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function loadJson(file, defaultVal = []) {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      return defaultVal;
    }
  }
  return defaultVal;
}

function saveJsonAtomic(file, data, bakFile = null) {
  if (bakFile && fs.existsSync(file)) {
    try { fs.copyFileSync(file, bakFile); } catch (e) {}
  }
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function sanitizeSlug(text) {
  if (!text) return 'unspecified';
  const clean = text.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean.slice(0, 40) || 'unspecified';
}

function logActivity(leadId, actType, summary, outcome = '', owner = 'Staff') {
  const activities = loadJson(activitiesFile, []);
  const now = new Date().toISOString();
  const num = Math.floor(Math.random() * 90000 + 10000);
  const newAct = {
    activityId: `ACT-${num}`,
    leadId,
    activityType: actType,
    activityAt: now,
    owner,
    summary,
    outcome,
    nextAction: '',
    followUpDate: ''
  };
  activities.unshift(newAct);
  saveJsonAtomic(activitiesFile, activities, activitiesBak);
  return newAct;
}

function formatVttTimestamp(seconds) {
  const secs = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs - Math.floor(secs)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function formatSrtTimestamp(seconds) {
  const secs = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs - Math.floor(secs)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function buildVtt(segments, fallbackText = '') {
  let lines = ['WEBVTT', ''];
  if (segments && segments.length) {
    segments.forEach((seg) => {
      lines.push(`${formatVttTimestamp(seg.start)} --> ${formatVttTimestamp(seg.end)}`);
      lines.push((seg.text || '').trim());
      lines.push('');
    });
  } else if (fallbackText) {
    lines.push('00:00:00.000 --> 00:05:00.000');
    lines.push(fallbackText.trim());
    lines.push('');
  }
  return lines.join('\n');
}

function buildSrt(segments, fallbackText = '') {
  let lines = [];
  if (segments && segments.length) {
    segments.forEach((seg, i) => {
      lines.push(String(i + 1));
      lines.push(`${formatSrtTimestamp(seg.start)} --> ${formatSrtTimestamp(seg.end)}`);
      lines.push((seg.text || '').trim());
      lines.push('');
    });
  } else if (fallbackText) {
    lines.push('1');
    lines.push('00:00:00,000 --> 00:05:00,000');
    lines.push(fallbackText.trim());
    lines.push('');
  }
  return lines.join('\n');
}

// Background polling for Whishper jobs
setInterval(async () => {
  try {
    const recordings = loadJson(recordingsFile, []);
    let updated = false;

    for (const rec of recordings) {
      if (['pending', 'processing'].includes(rec.transcriptionStatus) && rec.whishperJobId && !rec.whishperJobId.startsWith('worker-')) {
        const info = await whishperClient.getJobStatus(rec.whishperJobId);
        if (info && info.status === 'completed') {
          rec.transcriptionStatus = 'completed';
          rec.completedAt = new Date().toISOString();
          rec.language = info.language || 'auto';

          const year = String(new Date().getFullYear());
          const leadTransDir = path.join(transcriptsDir, rec.leadId, year);
          if (!fs.existsSync(leadTransDir)) fs.mkdirSync(leadTransDir, { recursive: true });

          const fullText = info.text || '';
          const segments = info.segments || [];

          const transJson = {
            recordingId: rec.recordingId,
            leadId: rec.leadId,
            whishperJobId: rec.whishperJobId,
            status: 'completed',
            language: rec.language,
            createdAt: rec.createdAt,
            completedAt: rec.completedAt,
            fullText,
            segments,
            rawResponseRelativePath: `transcripts/${rec.leadId}/${year}/${rec.recordingId}_raw.json`,
            editedText: '',
            editedAt: '',
            errorMessage: ''
          };

          fs.writeFileSync(path.join(leadTransDir, `${rec.recordingId}.json`), JSON.stringify(transJson, null, 2), 'utf8');
          fs.writeFileSync(path.join(leadTransDir, `${rec.recordingId}.txt`), fullText, 'utf8');
          fs.writeFileSync(path.join(leadTransDir, `${rec.recordingId}.vtt`), buildVtt(segments, fullText), 'utf8');
          fs.writeFileSync(path.join(leadTransDir, `${rec.recordingId}.srt`), buildSrt(segments, fullText), 'utf8');

          rec.transcriptRelativePath = `transcripts/${rec.leadId}/${year}/${rec.recordingId}.json`;
          updated = true;

          logActivity(rec.leadId, 'Record update', `Local Whishper transcription completed for recording ${rec.recordingId}.`, 'Transcript ready.');
        } else if (info && info.status === 'failed') {
          rec.transcriptionStatus = 'failed';
          rec.errorMessage = info.error || 'Transcription failed.';
          updated = true;
          logActivity(rec.leadId, 'Record update', `Local Whishper transcription failed for ${rec.recordingId}.`, rec.errorMessage);
        }
      }
    }

    if (updated) saveJsonAtomic(recordingsFile, recordings, recordingsBak);
  } catch (e) {}
}, 4000);

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // 1. Status
  if (pathname === '/api/status') {
    return sendJson(res, 200, {
      ok: true,
      server: 'Anna ETM Lead CRM Node Server',
      leadsFile,
      activitiesFile,
      recordingsFile,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Whishper Health
  if (pathname === '/api/whishper/status') {
    const health = await whishperClient.checkHealth();
    return sendJson(res, 200, health);
  }

  // 3. Leads GET / PUT
  if (pathname === '/api/leads') {
    if (req.method === 'GET') {
      return sendJson(res, 200, { leads: loadJson(leadsFile, null) });
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!Array.isArray(data)) throw new Error('Array expected');
          saveJsonAtomic(leadsFile, data, leadsBak);
          sendJson(res, 200, { ok: true, count: data.length });
        } catch (e) {
          sendJson(res, 400, { error: e.message });
        }
      });
      return;
    }
  }

  // 4. Activities GET / PUT
  if (pathname === '/api/activities') {
    if (req.method === 'GET') {
      return sendJson(res, 200, { activities: loadJson(activitiesFile, null) });
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!Array.isArray(data)) throw new Error('Array expected');
          saveJsonAtomic(activitiesFile, data, activitiesBak);
          sendJson(res, 200, { ok: true, count: data.length });
        } catch (e) {
          sendJson(res, 400, { error: e.message });
        }
      });
      return;
    }
  }

  // 5. Lead Recordings: GET / POST /api/leads/:leadId/recordings
  const leadRecMatch = pathname.match(/^\/api\/leads\/([^/]+)\/recordings$/);
  if (leadRecMatch) {
    const leadId = leadRecMatch[1];
    if (req.method === 'GET') {
      const recordings = loadJson(recordingsFile, []);
      const leadRecs = recordings.filter(r => r.leadId === leadId);
      for (const r of leadRecs) {
        if (r.transcriptRelativePath) {
          const abs = path.join(dataDir, r.transcriptRelativePath);
          if (fs.existsSync(abs)) r.transcriptData = loadJson(abs, {});
        }
      }
      return sendJson(res, 200, { recordings: leadRecs });
    }

    if (req.method === 'POST') {
      const leads = loadJson(leadsFile, []);
      let lead = leads.find(l => l.leadId === leadId);

      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          if (!lead) {
            const leadData = payload.lead || {};
            lead = {
              leadId,
              fullName: leadData.fullName || payload.fullName || 'Attendee',
              organisation: leadData.organisation || payload.organisation || 'Startup',
              email: leadData.email || '',
              phone: leadData.phone || '',
              createdAt: new Date().toISOString(),
              stage: leadData.stage || 'New',
              consent: leadData.consent || 'Yes',
              owner: payload.createdBy || 'Staff'
            };
            leads.unshift(lead);
            saveJsonAtomic(leadsFile, leads, leadsBak);
          }

          let base64Str = payload.audioBase64 || '';
          if (base64Str.includes(',')) base64Str = base64Str.split(',')[1];
          let audioBuffer = base64Str ? Buffer.from(base64Str, 'base64') : Buffer.alloc(1600);
          if (audioBuffer.length === 0) audioBuffer = Buffer.alloc(1600);

          const now = new Date();
          const year = String(now.getFullYear());
          const recId = `REC-2026-${Math.floor(Math.random() * 90000 + 10000)}`;
          const safeOrg = sanitizeSlug(lead.organisation);
          const safeLeadId = leadId.replace(/[^a-zA-Z0-9_-]/g, '-');
          const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '') + '_' + now.toTimeString().slice(0, 8).replace(/:/g, '');
          const filename = `${datePrefix}_${safeOrg}_${recId}.webm`;

          const leadDir = path.join(recordingsDir, safeLeadId, year);
          if (!fs.existsSync(leadDir)) fs.mkdirSync(leadDir, { recursive: true });
          const absAudio = path.join(leadDir, filename);

          fs.writeFileSync(absAudio + '.tmp', audioBuffer);
          fs.renameSync(absAudio + '.tmp', absAudio);

          const checksum = crypto.createHash('sha256').update(audioBuffer).digest('hex');
          const relAudio = `recordings/${safeLeadId}/${year}/${filename}`;

          const entity = {
            recordingId: recId,
            leadId,
            createdAt: now.toISOString(),
            createdBy: payload.createdBy || 'Staff',
            consentConfirmedAt: now.toISOString(),
            consentMethod: payload.consentMethod || 'In-person verbal agreement',
            durationSeconds: Number(payload.durationSeconds) || 0,
            audioMimeType: 'audio/webm',
            audioSizeBytes: audioBuffer.length,
            audioRelativePath: relAudio,
            audioChecksum: checksum,
            transcriptionStatus: 'pending',
            whishperJobId: '',
            transcriptRelativePath: '',
            language: payload.language || 'auto',
            completedAt: '',
            errorCode: '',
            errorMessage: '',
            editedTranscriptAt: ''
          };

          const sub = await whishperClient.submitAudio(absAudio, {
            model_size: payload.modelSize || 'small',
            language: payload.language || 'auto',
            device: 'cpu'
          });

          if (sub.success) {
            entity.whishperJobId = sub.job_id || '';
            entity.transcriptionStatus = sub.status || 'processing';
          } else if (sub.offline) {
            entity.transcriptionStatus = 'offline';
            entity.errorMessage = 'Local Whishper offline; audio preserved.';
          } else {
            entity.transcriptionStatus = 'failed';
            entity.errorMessage = sub.error || 'Failed to queue Whishper job.';
          }

          const recordings = loadJson(recordingsFile, []);
          recordings.unshift(entity);
          saveJsonAtomic(recordingsFile, recordings, recordingsBak);

          logActivity(leadId, 'Meeting', `Recorded conversation with ${lead.fullName} (${entity.durationSeconds}s).`, `Saved locally. Status: ${entity.transcriptionStatus}.`);
          sendJson(res, 201, { success: true, recording: entity });
        } catch (e) {
          sendJson(res, 400, { error: e.message });
        }
      });
      return;
    }
  }

  // 6. Global Recordings GET /api/recordings
  if (pathname === '/api/recordings') {
    const recordings = loadJson(recordingsFile, []);
    return sendJson(res, 200, { recordings });
  }

  // 7. Single Recording Audio: GET /api/recordings/:id/audio
  const audioMatch = pathname.match(/^\/api\/recordings\/([^/]+)\/audio$/);
  if (audioMatch) {
    const recId = audioMatch[1];
    const recordings = loadJson(recordingsFile, []);
    const rec = recordings.find(r => r.recordingId === recId);
    if (!rec || !rec.audioRelativePath) return sendJson(res, 404, { error: 'Recording audio not found' });

    const absAudio = path.join(dataDir, rec.audioRelativePath);
    if (!fs.existsSync(absAudio)) return sendJson(res, 404, { error: 'Audio file missing from disk' });

    const stat = fs.statSync(absAudio);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(absAudio, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'audio/webm'
      });
      return fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': 'audio/webm',
        'Accept-Ranges': 'bytes'
      });
      return fs.createReadStream(absAudio).pipe(res);
    }
  }

  // 8. Recording Transcription GET & PUT
  const transMatch = pathname.match(/^\/api\/recordings\/([^/]+)\/transcription$/);
  if (transMatch) {
    const recId = transMatch[1];
    const recordings = loadJson(recordingsFile, []);
    const rec = recordings.find(r => r.recordingId === recId);
    if (!rec) return sendJson(res, 404, { error: 'Recording not found' });

    if (req.method === 'GET') {
      const year = (rec.createdAt || '').slice(0, 4) || String(new Date().getFullYear());
      const jsonFile = path.join(transcriptsDir, rec.leadId, year, `${recId}.json`);
      if (fs.existsSync(jsonFile)) {
        const transData = loadJson(jsonFile, {});
        transData.status = rec.transcriptionStatus;
        return sendJson(res, 200, transData);
      }
      return sendJson(res, 200, {
        recordingId: rec.recordingId,
        leadId: rec.leadId,
        whishperJobId: rec.whishperJobId || '',
        status: rec.transcriptionStatus || 'pending',
        language: rec.language || 'auto',
        createdAt: rec.createdAt || '',
        completedAt: rec.completedAt || '',
        fullText: '',
        segments: [],
        rawResponseRelativePath: '',
        editedText: rec.editedText || '',
        editedAt: rec.editedTranscriptAt || '',
        errorMessage: rec.errorMessage || '',
        transcriptRelativePath: ''
      });
    }

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const editedText = payload.editedText || '';
          const nowIso = new Date().toISOString();
          const year = (rec.createdAt || '').slice(0, 4) || String(new Date().getFullYear());
          const leadTransDir = path.join(transcriptsDir, rec.leadId, year);
          if (!fs.existsSync(leadTransDir)) fs.mkdirSync(leadTransDir, { recursive: true });

          const jsonFile = path.join(leadTransDir, `${recId}.json`);
          let currentTranscript = loadJson(jsonFile, null);
          if (!currentTranscript) {
            currentTranscript = {
              recordingId: recId,
              leadId: rec.leadId,
              whishperJobId: rec.whishperJobId || '',
              status: rec.transcriptionStatus || 'offline',
              language: rec.language || 'auto',
              createdAt: rec.createdAt || nowIso,
              completedAt: '',
              fullText: editedText,
              segments: [],
              rawResponseRelativePath: '',
              editedText,
              editedAt: nowIso,
              errorMessage: ''
            };
          } else {
            currentTranscript.editedText = editedText;
            currentTranscript.editedAt = nowIso;
          }

          fs.writeFileSync(jsonFile, JSON.stringify(currentTranscript, null, 2), 'utf8');

          const finalTxt = editedText || currentTranscript.fullText || '';
          fs.writeFileSync(path.join(leadTransDir, `${recId}.txt`), finalTxt, 'utf8');
          fs.writeFileSync(path.join(leadTransDir, `${recId}.vtt`), buildVtt(currentTranscript.segments || [], finalTxt), 'utf8');
          fs.writeFileSync(path.join(leadTransDir, `${recId}.srt`), buildSrt(currentTranscript.segments || [], finalTxt), 'utf8');

          rec.editedTranscriptAt = nowIso;
          rec.transcriptRelativePath = `transcripts/${rec.leadId}/${year}/${recId}.json`;
          saveJsonAtomic(recordingsFile, recordings, recordingsBak);

          logActivity(rec.leadId, 'Record update', `Staff updated transcript text for recording ${recId}.`, 'Edits saved locally.');
          return sendJson(res, 200, { success: true, editedAt: nowIso, transcription: currentTranscript });
        } catch (e) {
          sendJson(res, 400, { error: e.message });
        }
      });
      return;
    }
  }

  // 9. Retry Transcription: POST /api/recordings/:id/transcribe
  const retryMatch = pathname.match(/^\/api\/recordings\/([^/]+)\/transcribe$/);
  if (retryMatch && req.method === 'POST') {
    const recId = retryMatch[1];
    const recordings = loadJson(recordingsFile, []);
    const rec = recordings.find(r => r.recordingId === recId);
    if (!rec) return sendJson(res, 404, { error: 'Recording not found' });

    const absAudio = path.join(dataDir, rec.audioRelativePath || '');
    if (!fs.existsSync(absAudio)) return sendJson(res, 404, { error: 'Audio file missing from local disk' });

    const sub = await whishperClient.submitAudio(absAudio, {
      model_size: 'small',
      language: rec.language || 'auto',
      device: 'cpu'
    });

    if (sub.success) {
      rec.whishperJobId = sub.job_id || '';
      rec.transcriptionStatus = sub.status || 'processing';
      rec.errorMessage = '';
      saveJsonAtomic(recordingsFile, recordings, recordingsBak);

      logActivity(rec.leadId, 'Record update', `Re-submitted recording ${recId} to local Whishper transcription.`, 'Transcription in progress.');
      return sendJson(res, 200, { success: true, status: rec.transcriptionStatus });
    } else {
      rec.transcriptionStatus = 'failed';
      rec.errorMessage = sub.error || 'Whishper offline or failed.';
      saveJsonAtomic(recordingsFile, recordings, recordingsBak);
      return sendJson(res, 503, { success: false, error: rec.errorMessage });
    }
  }

  // 10. Download Formats: GET /api/recordings/:id/download/:format
  const dlMatch = pathname.match(/^\/api\/recordings\/([^/]+)\/download\/([a-zA-Z0-9]+)$/);
  if (dlMatch) {
    const recId = dlMatch[1];
    const fmt = dlMatch[2].toLowerCase();
    const recordings = loadJson(recordingsFile, []);
    const rec = recordings.find(r => r.recordingId === recId);
    if (!rec) return sendJson(res, 404, { error: 'Recording not found' });

    let absPath = '';
    let downloadName = '';
    let mime = 'text/plain';

    if (fmt === 'audio') {
      if (!rec.audioRelativePath) return sendJson(res, 404, { error: 'Audio not found' });
      absPath = path.join(dataDir, rec.audioRelativePath);
      const ext = path.extname(absPath) || '.webm';
      downloadName = `${recId}${ext}`;
      mime = rec.audioMimeType || 'audio/webm';
    } else {
      const year = (rec.createdAt || '').slice(0, 4) || String(new Date().getFullYear());
      downloadName = `${recId}.${fmt}`;
      absPath = path.join(transcriptsDir, rec.leadId, year, downloadName);
      mime = MIME_TYPES['.' + fmt] || 'text/plain';

      if (!fs.existsSync(absPath)) {
        if (fmt === 'vtt' || fmt === 'srt') {
          const jsonFile = path.join(transcriptsDir, rec.leadId, year, `${recId}.json`);
          const txtFile = path.join(transcriptsDir, rec.leadId, year, `${recId}.txt`);
          const transData = fs.existsSync(jsonFile) ? loadJson(jsonFile, {}) : {};
          let fallback = transData.editedText || transData.fullText || '';
          if (!fallback && fs.existsSync(txtFile)) fallback = fs.readFileSync(txtFile, 'utf8');

          if (fallback || (transData.segments && transData.segments.length)) {
            const derived = fmt === 'vtt' ? buildVtt(transData.segments || [], fallback) : buildSrt(transData.segments || [], fallback);
            fs.writeFileSync(absPath, derived, 'utf8');
          }
        }
      }
    }

    if (!fs.existsSync(absPath)) {
      return sendJson(res, 404, { error: `Format '${fmt}' not available on disk` });
    }

    const stat = fs.statSync(absPath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Content-Length': stat.size
    });
    return fs.createReadStream(absPath).pipe(res);
  }

  // 11. Delete Recording: DELETE /api/recordings/:id
  const delMatch = pathname.match(/^\/api\/recordings\/([^/]+)$/);
  if (delMatch && req.method === 'DELETE') {
    const recId = delMatch[1];
    let recordings = loadJson(recordingsFile, []);
    const rec = recordings.find(r => r.recordingId === recId);
    if (!rec) return sendJson(res, 200, { success: true, message: 'Recording already removed' });

    if (rec.audioRelativePath) {
      const absAudio = path.join(dataDir, rec.audioRelativePath);
      if (fs.existsSync(absAudio)) fs.unlinkSync(absAudio);
    }

    const year = (rec.createdAt || '').slice(0, 4) || String(new Date().getFullYear());
    const leadTransDir = path.join(transcriptsDir, rec.leadId, year);
    ['.json', '.txt', '.vtt', '.srt', '_raw.json'].forEach(ext => {
      const p = path.join(leadTransDir, `${recId}${ext}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    if (rec.whishperJobId) whishperClient.deleteRemoteJob(rec.whishperJobId);

    recordings = recordings.filter(r => r.recordingId !== recId);
    saveJsonAtomic(recordingsFile, recordings, recordingsBak);

    logActivity(rec.leadId, 'Record update', `Deleted recording ${recId}.`, 'Removed from local disk.');
    return sendJson(res, 200, { success: true });
  }

  // 9. Static File Serving
  const safePath = path.normalize(pathname.replace(/^\/+/, ''));
  const filePath = path.join(root, safePath === '' ? 'index.html' : safePath);

  if (!filePath.startsWith(root)) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) return send(res, 500, 'Server error');
      send(res, 200, content, mime);
    });
  });
});

function listenOnAvailablePort(ports) {
  if (!ports.length) {
    console.error('Could not bind to any port');
    process.exit(1);
  }
  const currentPort = ports[0];
  const testServer = server.listen(currentPort, '127.0.0.1', () => {
    console.log(`Anna Incubator ETM 2026 CRM running at http://127.0.0.1:${currentPort}`);
    console.log(`Data directory: ${dataDir}`);
    console.log(`Whishper URL: ${whishperClient.baseUrl}`);
  });
  testServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      listenOnAvailablePort(ports.slice(1));
    } else {
      console.error('Server error:', err);
    }
  });
}

listenOnAvailablePort([port, 8080, 8000, 3000, 5000]);
