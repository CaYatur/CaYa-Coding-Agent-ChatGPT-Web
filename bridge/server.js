'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const VERSION = '0.1.1';
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 120_000;
const ACTION_TIMEOUT_MS = 32_000;
const POLL_TIMEOUT_MS = 25_000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessions = new Map();
const pending = new Map();
const rate = new Map();

function shortSession(value) {
  const s = String(value || '');
  return s.length <= 8 ? s : `${s.slice(0, 6)}…${s.slice(-4)}`;
}
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}
function secretsEqual(storedHash, secret) {
  const candidate = hashSecret(secret);
  return storedHash.length === candidate.length && crypto.timingSafeEqual(storedHash, candidate);
}
function id(bytes = 18) { return crypto.randomBytes(bytes).toString('base64url'); }
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
}
function sendHtml(res, status, html) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(html),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  });
  res.end(html);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Request body too large.'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('Invalid JSON.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function clientIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}
function rateLimited(req) {
  const key = clientIp(req);
  const now = Date.now();
  let entry = rate.get(key);
  if (!entry || now - entry.started > 60_000) entry = { started: now, count: 0 };
  entry.count++;
  rate.set(key, entry);
  return entry.count > 180;
}
function getSession(sessionId, sessionSecret) {
  const session = sessions.get(String(sessionId || ''));
  if (!session) throw Object.assign(new Error('Unknown or offline session.'), { status: 404, code: 'SESSION_OFFLINE' });
  if (!secretsEqual(session.secretHash, sessionSecret || '')) throw Object.assign(new Error('Invalid session secret.'), { status: 401, code: 'BAD_SECRET' });
  if (Date.now() - session.lastSeen > SESSION_TTL_MS) {
    sessions.delete(session.id);
    throw Object.assign(new Error('Session expired/offline.'), { status: 404, code: 'SESSION_EXPIRED' });
  }
  return session;
}
function deliverTask(session, task) {
  const waiter = session.pollWaiters.shift();
  if (waiter) {
    log(`task ${task.id} ${task.operation} -> waiting agent ${shortSession(session.id)}`);
    waiter(task);
  } else {
    session.queue.push(task);
    log(`task ${task.id} ${task.operation} queued for agent ${shortSession(session.id)} (queue=${session.queue.length})`);
  }
}
function enqueueAndWait(session, operation, payload) {
  const task = { id: id(12), operation, payload: payload || {}, createdAt: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setTimeout(() => {
      pending.delete(task.id);
      log(`task ${task.id} ${operation} TIMEOUT after ${Date.now() - started}ms`);
      reject(Object.assign(new Error('Agent did not return a result before the bridge timeout.'), { status: 504, code: 'AGENT_TIMEOUT' }));
    }, ACTION_TIMEOUT_MS);
    pending.set(task.id, { resolve, reject, timer, sessionId: session.id, operation, started });
    deliverTask(session, task);
  });
}
function operationFor(pathname) {
  return ({
    '/v1/workspace/info': 'workspace.info',
    '/v1/workspace/tree': 'workspace.tree',
    '/v1/file/read': 'file.read',
    '/v1/file/search': 'file.search',
    '/v1/file/create': 'file.create',
    '/v1/file/replace': 'file.replace',
    '/v1/file/delete': 'file.delete',
    '/v1/terminal/start': 'terminal.start',
    '/v1/terminal/result': 'terminal.result',
    '/v1/terminal/cancel': 'terminal.cancel',
    '/v1/git/status': 'git.status',
    '/v1/git/diff': 'git.diff'
  })[pathname];
}

const server = http.createServer(async (req, res) => {
  try {
    if (rateLimited(req)) return send(res, 429, { error: 'RATE_LIMITED' });
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'CaYa Bridge', version: VERSION, onlineSessions: sessions.size });
    }
    if (req.method === 'GET' && url.pathname === '/privacy') {
      return sendHtml(res, 200, `<!doctype html><meta charset="utf-8"><title>CaYa Coding Agent Privacy</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.55}code{background:#eee;padding:2px 4px}</style><h1>CaYa Coding Agent — Privacy</h1><p>This bridge relays requests between a GPT Action and a locally running CaYa Agent session. Session credentials and coding data are used only to route the requested operation.</p><p>This reference implementation stores active sessions and pending requests in memory and does not intentionally persist source code or terminal output. Reverse proxies or hosting providers may have their own logs; configure them accordingly.</p><p>Users choose the local workspace exposed by the agent. Treat the temporary session secret as a password and stop the local agent when finished.</p><p>Before publishing a public GPT, replace this template with your real operator identity, contact information, retention policy, hosting details, and applicable privacy terms.</p>`);
    }

    if (req.method !== 'POST') return send(res, 404, { error: 'NOT_FOUND' });
    const body = await readJson(req);

    if (url.pathname === '/internal/agent/register') {
      const sessionId = String(body.sessionId || '');
      const sessionSecret = String(body.sessionSecret || '');
      if (sessionId.length < 12 || sessionSecret.length < 24) return send(res, 400, { error: 'Weak or missing session credentials.' });
      const existing = sessions.get(sessionId);
      if (existing && !secretsEqual(existing.secretHash, sessionSecret)) return send(res, 409, { error: 'Session id is already registered with another secret.' });
      const session = existing || { id: sessionId, secretHash: hashSecret(sessionSecret), queue: [], pollWaiters: [], metadata: {} };
      session.lastSeen = Date.now();
      session.metadata = body.metadata || {};
      sessions.set(sessionId, session);
      log(`agent registered ${shortSession(sessionId)} (${session.metadata?.workspaceName || 'workspace'}, terminal=${Boolean(session.metadata?.terminalEnabled)})`);
      return send(res, 200, { ok: true, sessionId, expiresAfterSeconds: SESSION_TTL_MS / 1000 });
    }

    if (url.pathname === '/internal/agent/poll') {
      const session = getSession(body.sessionId, body.sessionSecret);
      session.lastSeen = Date.now();

      // A task may have arrived between two long-poll requests.
      if (session.queue.length) {
        const task = session.queue.shift();
        log(`agent ${shortSession(session.id)} picked queued task ${task.id} ${task.operation}`);
        return send(res, 200, { task });
      }

      let settled = false;
      let timer = null;

      const removeWaiter = () => {
        session.pollWaiters = session.pollWaiters.filter(w => w !== finish);
      };

      const finish = task => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);

        // Critical: also remove a waiter when the NORMAL 25s poll timeout fires.
        // Otherwise a stale waiter can consume the next real task.
        removeWaiter();

        if (res.writableEnded || res.destroyed) return;
        if (task) log(`agent ${shortSession(session.id)} received task ${task.id} ${task.operation}`);
        send(res, 200, { task: task || null });
      };

      timer = setTimeout(() => finish(null), POLL_TIMEOUT_MS);
      session.pollWaiters.push(finish);

      // Do NOT use req.on('close') here. IncomingMessage may emit close after
      // the request body has completed even though the long-poll response is
      // intentionally still open.
      res.on('close', () => {
        if (res.writableEnded || settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        removeWaiter();
        log(`agent ${shortSession(session.id)} poll connection closed early`);
      });

      return;
    }

    if (url.pathname === '/internal/agent/result') {
      const session = getSession(body.sessionId, body.sessionSecret);
      session.lastSeen = Date.now();
      const p = pending.get(String(body.taskId || ''));
      if (!p || p.sessionId !== session.id) return send(res, 404, { error: 'Unknown pending task.' });
      pending.delete(body.taskId);
      clearTimeout(p.timer);
      log(`result ${body.taskId} ${p.operation || ''} from ${shortSession(session.id)} ok=${Boolean(body.ok)} in ${Date.now() - (p.started || Date.now())}ms`);
      p.resolve(body.ok ? { ok: true, data: body.data } : { ok: false, error: body.error || { message: 'Agent operation failed.' } });
      return send(res, 200, { ok: true });
    }

    const operation = operationFor(url.pathname);
    if (!operation) return send(res, 404, { error: 'NOT_FOUND' });
    const session = getSession(body.sessionId, body.sessionSecret);
    const payload = { ...body };
    delete payload.sessionId;
    delete payload.sessionSecret;
    const result = await enqueueAndWait(session, operation, payload);
    if (!result.ok) return send(res, 409, { ok: false, error: result.error });
    return send(res, 200, { ok: true, data: result.data });
  } catch (error) {
    const status = Number(error.status || 500);
    send(res, status, { ok: false, error: { code: error.code || 'BRIDGE_ERROR', message: String(error.message || error) } });
  }
});

const janitor = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.lastSeen > SESSION_TTL_MS) sessions.delete(sessionId);
  }
  for (const [ip, entry] of rate) {
    if (now - entry.started > 120_000) rate.delete(ip);
  }
}, 60_000);
janitor.unref();

server.listen(PORT, HOST, () => {
  console.log(`CaYa Bridge ${VERSION} listening on http://${HOST}:${PORT}`);
  console.log('Production: place this behind HTTPS/TLS 1.2+ on public port 443.');
});
