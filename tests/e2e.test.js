'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repo = path.resolve(__dirname, '..');
const port = 18787 + Math.floor(Math.random() * 1000);
const bridgeUrl = `http://127.0.0.1:${port}`;
const sessionId = 'test-session-1234567890';
const sessionSecret = 'test-secret-abcdefghijklmnopqrstuvwxyz-123456';
const children = [];

function start(cmd, args, options = {}) {
  const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  child.stdout.on('data', () => {});
  child.stderr.on('data', d => process.stderr.write(d));
  return child;
}

async function waitFor(fn, timeout = 8000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch (e) { last = e; }
    await new Promise(r => setTimeout(r, 100));
  }
  throw last || new Error('Timed out');
}

async function api(pathname, extra = {}) {
  const res = await fetch(`${bridgeUrl}${pathname}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, sessionSecret, ...extra })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data.data;
}

(async () => {
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'caya-agent-test-'));
  try {
    start(process.execPath, [path.join(repo, 'bridge/server.js')], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) } });
    await waitFor(async () => {
      const r = await fetch(`${bridgeUrl}/health`); return r.ok;
    });

    start(process.execPath, [path.join(repo, 'agent/index.js'), '--bridge', bridgeUrl, '--workspace', workspace, '--session', sessionId, '--secret', sessionSecret, '--allow-terminal']);
    await waitFor(async () => {
      try { return (await api('/v1/workspace/info')).workspaceName !== undefined; } catch { return false; }
    });

    const created = await api('/v1/file/create', { path: 'src/test.txt', content: 'hello\nworld\n' });
    assert.equal(created.sha256.length, 64);

    const read = await api('/v1/file/read', { path: 'src/test.txt' });
    assert.equal(read.content, 'hello\nworld\n');

    const replaced = await api('/v1/file/replace', {
      path: 'src/test.txt', oldText: 'world', newText: 'agent', expectedSha256: read.sha256
    });
    assert.notEqual(replaced.sha256, read.sha256);

    const reread = await api('/v1/file/read', { path: 'src/test.txt' });
    assert.equal(reread.content, 'hello\nagent\n');

    const search = await api('/v1/file/search', { query: 'agent' });
    assert.equal(search.results[0].path, 'src/test.txt');

    const tree = await api('/v1/workspace/tree', { depth: 3 });
    assert(tree.entries.some(e => e.path === 'src/test.txt'));

    const job = await api('/v1/terminal/start', { executable: 'node', args: ['-e', 'console.log("job-ok")'], timeoutSeconds: 20 });
    const done = await waitFor(async () => {
      const j = await api('/v1/terminal/result', { jobId: job.id });
      return j.status === 'finished' ? j : false;
    });
    assert.equal(done.exitCode, 0);
    assert.match(done.stdout, /job-ok/);

    const deleted = await api('/v1/file/delete', { path: 'src/test.txt', expectedSha256: reread.sha256 });
    assert.match(deleted.recoverableAt, /^\.caya-agent\/trash\//);
    assert.equal(fs.existsSync(path.join(workspace, 'src/test.txt')), false);

    console.log('E2E PASS: bridge <-> agent file operations and terminal jobs work.');
  } finally {
    for (const child of children) child.kill();
    await fsp.rm(workspace, { recursive: true, force: true });
  }
})().catch(err => {
  console.error(err.stack || err);
  for (const child of children) child.kill();
  process.exitCode = 1;
});
