/**
 * Anna Incubator ETM CRM - Local Whishper Transcription Adapter (Node.js)
 * Communicates locally with self-hosted Whishper (Tag v3.1.4 / main).
 * No third-party cloud services, no paid API keys.
 */

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const WHISHPER_BASE_URL = (process.env.WHISHPER_BASE_URL || 'http://127.0.0.1:8082').replace(/\/+$/, '');
const WHISHPER_API_KEY = process.env.WHISHPER_API_KEY || '';

class WhishperClient {
  constructor(baseUrl = WHISHPER_BASE_URL, apiKey = WHISHPER_API_KEY) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async checkHealth() {
    // 1. Try Whishper Full Suite (/api/transcriptions)
    try {
      const res = await this._fetch(`${this.baseUrl}/api/transcriptions`, { method: 'GET', timeout: 2500 });
      if (res.status === 200 || res.status === 201) {
        return {
          online: true,
          mode: 'whishper-full-suite',
          url: this.baseUrl,
          status: 'ready',
          message: 'Local Whishper full service is active and responding.'
        };
      }
    } catch (e) {}

    // 2. Try Whishper Standalone Worker (/healthcheck/)
    try {
      const res = await this._fetch(`${this.baseUrl}/healthcheck/`, { method: 'GET', timeout: 2500 });
      if (res.status === 200) {
        return {
          online: true,
          mode: 'whishper-worker-api',
          url: this.baseUrl,
          status: 'ready',
          message: 'Local Whishper worker API is active and healthy.'
        };
      }
    } catch (e) {}

    return {
      online: false,
      mode: 'offline',
      url: this.baseUrl,
      status: 'offline',
      message: `Local Whishper service is not reachable at ${this.baseUrl}. Audio recordings remain safely preserved on local disk.`
    };
  }

  async submitAudio(audioFilePath, options = {}) {
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    const health = await this.checkHealth();
    if (!health.online) {
      return {
        success: false,
        offline: true,
        error: 'Local Whishper service is offline. Recording preserved locally.'
      };
    }

    const modelSize = options.model_size || 'small';
    const language = options.language || 'auto';
    const device = options.device || 'cpu';

    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
    const filename = path.basename(audioFilePath);
    const fileData = fs.readFileSync(audioFilePath);

    const isFullSuite = health.mode === 'whishper-full-suite';
    const endpoint = isFullSuite ? `${this.baseUrl}/api/transcriptions` : `${this.baseUrl}/transcribe/`;

    let formHeader = '';
    const addField = (name, val) => {
      formHeader += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${val}\r\n`;
    };

    if (isFullSuite) {
      addField('language', language);
      addField('modelSize', modelSize);
      addField('device', device);
      addField('task', 'transcribe');
    } else {
      addField('language', language);
      addField('model_size', modelSize);
      addField('device', device);
    }

    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(formHeader + fileHeader, 'utf8'),
      fileData,
      Buffer.from(footer, 'utf8')
    ]);

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyBuffer.length,
      'User-Agent': 'AnnaETM-CRM-Adapter/1.0'
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    try {
      const res = await this._fetch(endpoint, {
        method: 'POST',
        headers,
        body: bodyBuffer,
        timeout: 300000
      });
      const data = JSON.parse(res.body);

      if (data.id) {
        const rawStatus = data.status || 0;
        const crmStatus = rawStatus === 2 ? 'completed' : (rawStatus === 1 ? 'processing' : 'pending');
        const result = data.result || {};
        return {
          success: true,
          job_id: String(data.id),
          status: crmStatus,
          raw_data: data,
          text: result.text || '',
          segments: result.segments || [],
          language: data.language || language
        };
      } else if (data.text || data.segments) {
        return {
          success: true,
          job_id: `worker-${Date.now()}`,
          status: 'completed',
          raw_data: data,
          text: data.text || '',
          segments: data.segments || [],
          language: data.language || language
        };
      }
      return {
        success: true,
        job_id: String(data._id || Date.now()),
        status: 'pending',
        raw_data: data
      };
    } catch (e) {
      return {
        success: false,
        offline: false,
        error: `Whishper submission error: ${e.message}`
      };
    }
  }

  async getJobStatus(jobId) {
    if (!jobId || jobId.startsWith('worker-')) return null;
    const url = `${this.baseUrl}/api/transcriptions/${jobId}`;
    const headers = { 'User-Agent': 'AnnaETM-CRM-Adapter/1.0' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    try {
      const res = await this._fetch(url, { method: 'GET', headers, timeout: 10000 });
      const data = JSON.parse(res.body);
      const rawStatus = data.status || 0;
      const statusMap = { 0: 'pending', 1: 'processing', 2: 'completed', [-1]: 'failed' };
      const statusStr = statusMap[rawStatus] || 'processing';
      const result = data.result || {};

      return {
        job_id: jobId,
        status: statusStr,
        raw_status: rawStatus,
        text: result.text || '',
        segments: result.segments || [],
        language: data.language || 'auto',
        raw_data: data
      };
    } catch (e) {
      return { job_id: jobId, status: 'error', error: e.message };
    }
  }

  async deleteRemoteJob(jobId) {
    if (!jobId || jobId.startsWith('worker-')) return true;
    try {
      const res = await this._fetch(`${this.baseUrl}/api/transcriptions/${jobId}`, {
        method: 'DELETE',
        headers: { 'User-Agent': 'AnnaETM-CRM-Adapter/1.0' },
        timeout: 5000
      });
      return res.status === 200 || res.status === 204;
    } catch (e) {
      return false;
    }
  }

  _fetch(urlStr, { method = 'GET', headers = {}, body = null, timeout = 10000 } = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.request(parsed, { method, headers, timeout }, (res) => {
        let chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8')
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

module.exports = {
  WhishperClient,
  defaultClient: new WhishperClient()
};
