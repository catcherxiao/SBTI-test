const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.resolve(__dirname);
const DATA_FILE = path.resolve(process.env.SBTI_DATA_FILE || path.join(__dirname, 'data', 'result-latest.json'));
const MAX_BODY_SIZE = 8 * 1024;
const SAME_ORIGIN_ONLY = (process.env.SBTI_SAME_ORIGIN_ONLY || 'true').toLowerCase() !== 'false';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.manifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp'
};

function ensureDataDir() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

function loadStore() {
  ensureDataDir();

  if (!fs.existsSync(DATA_FILE)) {
    return {
      version: 1,
      updatedAt: null,
      records: {}
    };
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !parsed.records || typeof parsed.records !== 'object') {
    throw new Error(`统计数据文件格式无效: ${DATA_FILE}`);
  }

  return {
    version: Number(parsed.version) || 1,
    updatedAt: parsed.updatedAt || null,
    records: parsed.records
  };
}

const store = loadStore();

function persistStore() {
  ensureDataDir();
  store.updatedAt = new Date().toISOString();

  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(store, null, 2));
  fs.renameSync(tempFile, DATA_FILE);
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, message, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...extraHeaders
  });
  res.end(message);
}

function getRequestOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;

  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function getCorsHeaders(req) {
  const originUrl = getRequestOrigin(req);
  if (!originUrl) return {};

  if (!SAME_ORIGIN_ONLY) {
    return {
      'Access-Control-Allow-Origin': originUrl.origin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
  }

  if (originUrl.host !== req.headers.host) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': originUrl.origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function handlePreflight(req, res) {
  const corsHeaders = getCorsHeaders(req);
  if (corsHeaders === null) {
    sendJson(res, 403, { ok: false, error: 'origin_not_allowed' });
    return true;
  }

  res.writeHead(204, corsHeaders);
  res.end();
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_SIZE) {
        reject(new Error('payload_too_large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid_json'));
      }
    });

    req.on('error', reject);
  });
}

function isValidAnonymousId(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}

function isValidFinalType(value) {
  return typeof value === 'string' && value.length >= 2 && value.length <= 32 && /^[A-Za-z0-9!_-]+$/.test(value);
}

function isValidVersion(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 64 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function normalizeCreatedAt(value) {
  if (typeof value !== 'string') return new Date().toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function upsertResult(payload) {
  const now = new Date().toISOString();
  store.records[payload.anonymousId] = {
    anonymousId: payload.anonymousId,
    finalType: payload.finalType,
    special: Boolean(payload.special),
    createdAt: normalizeCreatedAt(payload.createdAt),
    version: payload.version,
    updatedAt: now
  };

  persistStore();
  return store.records[payload.anonymousId];
}

function getFilteredRecords(versionFilter = '') {
  const records = Object.values(store.records);
  if (!versionFilter) return records;
  return records.filter((record) => record.version === versionFilter);
}

function buildStatsPayload(versionFilter = '') {
  const records = getFilteredRecords(versionFilter);
  const totalUsers = records.length;
  const specialUsers = records.filter((record) => record.special).length;
  const normalUsers = totalUsers - specialUsers;

  const typeCounts = new Map();
  records.forEach((record) => {
    typeCounts.set(record.finalType, (typeCounts.get(record.finalType) || 0) + 1);
  });

  const types = [...typeCounts.entries()]
    .map(([finalType, count]) => ({
      finalType,
      count,
      percentage: totalUsers ? Number(((count / totalUsers) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.finalType.localeCompare(b.finalType, 'en');
    });

  const versionCounts = new Map();
  Object.values(store.records).forEach((record) => {
    versionCounts.set(record.version, (versionCounts.get(record.version) || 0) + 1);
  });

  const versions = [...versionCounts.entries()]
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.version.localeCompare(b.version, 'en');
    });

  return {
    ok: true,
    versionFilter: versionFilter || null,
    totalUsers,
    normalUsers,
    specialUsers,
    typeCount: types.length,
    updatedAt: store.updatedAt,
    generatedAt: new Date().toISOString(),
    versions,
    types
  };
}

async function handlePostResult(req, res) {
  const corsHeaders = getCorsHeaders(req);
  if (corsHeaders === null) {
    sendJson(res, 403, { ok: false, error: 'origin_not_allowed' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const code = error.message === 'payload_too_large' ? 413 : 400;
    sendJson(res, code, { ok: false, error: error.message }, corsHeaders || {});
    return;
  }

  if (!isValidAnonymousId(body.anonymousId)) {
    sendJson(res, 400, { ok: false, error: 'invalid_anonymous_id' }, corsHeaders || {});
    return;
  }

  if (!isValidFinalType(body.finalType)) {
    sendJson(res, 400, { ok: false, error: 'invalid_final_type' }, corsHeaders || {});
    return;
  }

  if (typeof body.special !== 'boolean') {
    sendJson(res, 400, { ok: false, error: 'invalid_special' }, corsHeaders || {});
    return;
  }

  if (!isValidVersion(body.version)) {
    sendJson(res, 400, { ok: false, error: 'invalid_version' }, corsHeaders || {});
    return;
  }

  const saved = upsertResult(body);
  sendJson(res, 200, { ok: true, saved }, corsHeaders || {});
}

function handleGetStats(req, res, url) {
  const corsHeaders = getCorsHeaders(req);
  if (corsHeaders === null) {
    sendJson(res, 403, { ok: false, error: 'origin_not_allowed' });
    return;
  }

  const versionFilter = url.searchParams.get('version') || '';
  if (versionFilter && !isValidVersion(versionFilter)) {
    sendJson(res, 400, { ok: false, error: 'invalid_version_filter' }, corsHeaders || {});
    return;
  }

  sendJson(res, 200, buildStatsPayload(versionFilter), corsHeaders || {});
}

function getStaticFilePath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const relativePath = decoded === '/' ? '/index.html' : decoded;
  const candidatePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(PUBLIC_DIR, candidatePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function serveStaticFile(req, res, pathname) {
  const filePath = getStaticFilePath(pathname);
  if (!filePath || !fs.existsSync(filePath)) {
    sendText(res, 404, 'Not Found');
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      sendText(res, 404, 'Not Found');
      return;
    }
    return serveStaticFile(req, res, path.join(pathname, 'index.html'));
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: 'invalid_request_url' });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    handlePreflight(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/result') {
    await handlePostResult(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/stats') {
    handleGetStats(req, res, url);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      updatedAt: store.updatedAt,
      totalUsers: Object.keys(store.records).length
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }

  serveStaticFile(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`SBTI server running at http://${HOST}:${PORT}`);
  console.log(`Analytics data file: ${DATA_FILE}`);
});
