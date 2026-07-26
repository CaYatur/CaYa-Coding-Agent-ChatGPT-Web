'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');

const VERSION = '0.1.0';
const MAX_TEXT = 80_000;
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.caya-agent',
  'dist',
  'build',
  '.next',
  '.cache',
  '.gradle',
  '.idea',
  '.vscode',
  'coverage',
  '.pytest_cache',
  '__pycache__',
  '.mypy_cache',
  '.ruff_cache',
  '.turbo',
  '.parcel-cache',
  '.nuxt',
  '.output',
  '.svelte-kit',
  'target',
  'bin',
  'obj'
]);

const DEFAULT_EXECUTABLES = [
  // ============================================================
  // Git / GitHub / source control
  // ============================================================
  'git',
  'gh',
  'git-lfs',

  // ============================================================
  // JavaScript / TypeScript / Node.js
  // ============================================================
  'node',
  'npm',
  'npx',
  'pnpm',
  'pnpx',
  'yarn',
  'bun',
  'bunx',
  'deno',
  'tsc',
  'tsx',
  'ts-node',

  // Test / lint / formatting - JS/TS
  'eslint',
  'prettier',
  'jest',
  'vitest',
  'mocha',
  'ava',
  'playwright',
  'cypress',

  // Frontend/build tooling
  'vite',
  'webpack',
  'rollup',
  'parcel',
  'turbo',
  'nx',

  // Framework CLIs
  'next',
  'nuxt',
  'ng',
  'nest',
  'expo',

  // ============================================================
  // Python
  // ============================================================
  'python',
  'python3',
  'py',
  'pip',
  'pip3',
  'pipx',

  // Python environment/package managers
  'poetry',
  'uv',
  'pdm',
  'pipenv',
  'conda',

  // Python tests / lint / formatting / typing
  'pytest',
  'ruff',
  'black',
  'isort',
  'mypy',
  'pyright',
  'flake8',
  'pylint',

  // Python frameworks / servers
  'django-admin',
  'flask',
  'uvicorn',
  'gunicorn',
  'alembic',

  // ============================================================
  // Java / Kotlin / JVM
  // ============================================================
  'java',
  'javac',
  'jar',
  'javadoc',
  'jshell',

  'gradle',
  'mvn',
  'mvnw',
  'ant',

  'kotlin',
  'kotlinc',

  // ============================================================
  // Android
  // ============================================================
  'adb',
  'fastboot',
  'aapt',
  'aapt2',
  'apkanalyzer',
  'sdkmanager',
  'avdmanager',
  'emulator',
  'lint',

  // ============================================================
  // Flutter / Dart
  // ============================================================
  'flutter',
  'dart',

  // ============================================================
  // .NET / C#
  // ============================================================
  'dotnet',
  'msbuild',
  'nuget',

  // ============================================================
  // C / C++
  // ============================================================
  'gcc',
  'g++',
  'clang',
  'clang++',
  'cl',

  'cmake',
  'ctest',
  'cpack',
  'make',
  'ninja',
  'meson',

  // Package managers for C/C++
  'conan',
  'vcpkg',

  // Debug / analysis
  'gdb',
  'lldb',

  // ============================================================
  // Rust
  // ============================================================
  'cargo',
  'rustc',
  'rustfmt',
  'rustup',
  'clippy',

  // ============================================================
  // Go
  // ============================================================
  'go',
  'gofmt',

  // ============================================================
  // PHP
  // ============================================================
  'php',
  'composer',
  'phpunit',
  'phpstan',
  'phpcs',

  // ============================================================
  // Ruby
  // ============================================================
  'ruby',
  'gem',
  'bundle',
  'bundler',
  'rake',
  'rspec',
  'rubocop',

  // ============================================================
  // Swift
  // ============================================================
  'swift',
  'swiftc',
  'swiftformat',
  'swiftlint',

  // ============================================================
  // Lua
  // ============================================================
  'lua',
  'luac',
  'luarocks',

  // ============================================================
  // Elixir / Erlang
  // ============================================================
  'elixir',
  'elixirc',
  'mix',
  'erl',
  'erlc',

  // ============================================================
  // Haskell
  // ============================================================
  'ghc',
  'ghci',
  'cabal',
  'stack',

  // ============================================================
  // Scala
  // ============================================================
  'scala',
  'scalac',
  'sbt',

  // ============================================================
  // Clojure
  // ============================================================
  'clojure',
  'clj',
  'lein',

  // ============================================================
  // Zig
  // ============================================================
  'zig',

  // ============================================================
  // R
  // ============================================================
  'R',
  'Rscript',

  // ============================================================
  // Julia
  // ============================================================
  'julia',

  // ============================================================
  // Database tooling
  // ============================================================
  'sqlite3',
  'psql',
  'mysql',
  'mariadb',
  'mongosh',
  'redis-cli',

  // ============================================================
  // Containers
  // ============================================================
  'docker',
  'docker-compose',
  'podman',

  // ============================================================
  // Kubernetes / local clusters
  // ============================================================
  'kubectl',
  'helm',
  'kind',
  'minikube',
  'k3d',

  // ============================================================
  // Infrastructure as Code
  // ============================================================
  'terraform',
  'tofu',
  'packer',

  // ============================================================
  // Cloud development/deployment CLIs
  // ============================================================
  'aws',
  'az',
  'gcloud',
  'firebase',
  'vercel',
  'netlify',

  // ============================================================
  // API / schema / protobuf
  // ============================================================
  'protoc',
  'buf',
  'grpcurl',
  'openapi-generator',
  'swagger-cli',

  // ============================================================
  // Data / JSON / YAML
  // ============================================================
  'jq',
  'yq',

  // ============================================================
  // Documentation
  // ============================================================
  'mkdocs',
  'sphinx-build',
  'doxygen',

  // ============================================================
  // Mobile / React Native
  // ============================================================
  'react-native',
  'eas',

  // ============================================================
  // Game development / engines
  // ============================================================
  'godot',

  // ============================================================
  // Code quality / security scanners
  // ============================================================
  'semgrep',
  'trivy',
  'sonar-scanner',

  // ============================================================
  // Misc developer tools
  // ============================================================
  'tree',
  'where',
  'whereis',
  'which'
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'allow-terminal') { out.allowTerminal = true; continue; }
    if (key === 'help') { out.help = true; continue; }
    const value = argv[i + 1];
    if (value !== undefined && !value.startsWith('--')) { out[key] = value; i++; }
  }
  return out;
}

function printHelp() {
  console.log(`CaYa Agent ${VERSION}\n\n` +
    'Usage:\n' +
    '  node agent/index.js --bridge https://bridge.example.com --workspace D:/GitHub/MyProject [--allow-terminal]\n\n' +
    'Options:\n' +
    '  --config <file>       JSON configuration file\n' +
    '  --bridge <url>        Public CaYa Bridge base URL\n' +
    '  --workspace <path>    Only workspace exposed to the agent\n' +
    '  --allow-terminal      Enable allow-listed process execution\n' +
    '  --session <id>        Optional fixed session id (testing/advanced)\n' +
    '  --secret <secret>     Optional fixed session secret (testing/advanced)\n');
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizeExecutable(name) {
  return process.platform === 'win32' ? name.toLowerCase().replace(/\.exe$/i, '') : name;
}

function loadConfig(args) {
  let fileConfig = {};
  if (args.config) {
    const raw = fs.readFileSync(path.resolve(args.config), 'utf8');
    fileConfig = JSON.parse(raw);
  }
  const bridge = args.bridge || fileConfig.bridge;
  const workspace = args.workspace || fileConfig.workspace;
  if (!bridge || !workspace) throw new Error('Both --bridge and --workspace are required (or provide them in --config).');
  const resolvedWorkspace = fs.realpathSync(path.resolve(workspace));
  if (!fs.statSync(resolvedWorkspace).isDirectory()) throw new Error('Workspace must be a directory.');
  return {
    bridge: String(bridge).replace(/\/$/, ''),
    workspace: resolvedWorkspace,
    allowTerminal: Boolean(args.allowTerminal || fileConfig.allowTerminal),
    allowedExecutables: new Set((fileConfig.allowedExecutables || DEFAULT_EXECUTABLES).map(normalizeExecutable)),
    sessionId: args.session || fileConfig.sessionId || randomToken(16),
    sessionSecret: args.secret || fileConfig.sessionSecret || randomToken(32)
  };
}

function isInside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

function lexicalPath(root, rel = '.') {
  if (typeof rel !== 'string' || rel.includes('\0')) throw new Error('Invalid path.');
  const candidate = path.resolve(root, rel);
  if (!isInside(root, candidate)) throw new Error('Path escapes workspace.');
  return candidate;
}

function resolveExisting(root, rel = '.') {
  const candidate = lexicalPath(root, rel);
  const real = fs.realpathSync(candidate);
  if (!isInside(root, real)) throw new Error('Resolved path escapes workspace (symlink denied).');
  return real;
}

function resolveForCreate(root, rel) {
  const candidate = lexicalPath(root, rel);
  let probe = path.dirname(candidate);
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const realParent = fs.realpathSync(probe);
  if (!isInside(root, realParent)) throw new Error('Parent path escapes workspace (symlink denied).');
  return candidate;
}

function relDisplay(root, abs) {
  return path.relative(root, abs).split(path.sep).join('/') || '.';
}

function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 7 || (byte > 13 && byte < 32)) suspicious++;
  }
  return sample.length > 0 && suspicious / sample.length > 0.15;
}

async function readTextFile(abs, maxBytes = 2_000_000) {
  const stat = await fsp.stat(abs);
  if (!stat.isFile()) throw new Error('Path is not a file.');
  if (stat.size > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes.`);
  const buf = await fsp.readFile(abs);
  if (isProbablyBinary(buf)) throw new Error('Binary file reading is not supported.');
  return buf.toString('utf8');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function snapshotFile(config, abs) {
  if (!fs.existsSync(abs)) return null;
  const stat = await fsp.lstat(abs);
  if (!stat.isFile()) return null;
  const rel = path.relative(config.workspace, abs);
  const dest = path.join(config.workspace, '.caya-agent', 'snapshots', timestamp(), rel);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(abs, dest);
  return relDisplay(config.workspace, dest);
}

function tree(config, payload) {
  const root = resolveExisting(config.workspace, payload.path || '.');
  const maxDepth = Math.max(0, Math.min(Number(payload.depth ?? 4), 8));
  const maxEntries = Math.max(1, Math.min(Number(payload.maxEntries ?? 800), 3000));
  const items = [];
  function walk(dir, depth) {
    if (items.length >= maxEntries || depth > maxDepth) return;
    let entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (items.length >= maxEntries) break;
      if (entry.name === '.caya-agent') continue;
      const abs = path.join(dir, entry.name);
      const rel = relDisplay(config.workspace, abs);
      if (entry.isSymbolicLink()) {
        items.push({ path: rel, type: 'symlink' });
        continue;
      }
      if (entry.isDirectory()) {
        items.push({ path: rel, type: 'directory' });
        if (!SKIP_DIRS.has(entry.name)) walk(abs, depth + 1);
      } else if (entry.isFile()) {
        let size = 0;
        try { size = fs.statSync(abs).size; } catch {}
        items.push({ path: rel, type: 'file', size });
      }
    }
  }
  walk(root, 0);
  return { root: relDisplay(config.workspace, root), entries: items, truncated: items.length >= maxEntries };
}

async function searchFiles(config, payload) {
  const query = String(payload.query || '');
  if (!query) throw new Error('query is required.');
  const base = resolveExisting(config.workspace, payload.path || '.');
  const maxResults = Math.max(1, Math.min(Number(payload.maxResults ?? 50), 200));
  const exts = Array.isArray(payload.extensions) && payload.extensions.length
    ? new Set(payload.extensions.map(x => String(x).toLowerCase().replace(/^\./, '')))
    : null;
  const results = [];
  const needle = payload.caseSensitive ? query : query.toLowerCase();
  async function walk(dir) {
    if (results.length >= maxResults) return;
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (entry.isSymbolicLink() || entry.name === '.caya-agent') continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (exts) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (!exts.has(ext)) continue;
      }
      let stat;
      try { stat = await fsp.stat(abs); } catch { continue; }
      if (stat.size > 1_000_000) continue;
      let text;
      try { text = await readTextFile(abs, 1_000_000); } catch { continue; }
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        const hay = payload.caseSensitive ? lines[i] : lines[i].toLowerCase();
        if (hay.includes(needle)) {
          results.push({ path: relDisplay(config.workspace, abs), line: i + 1, text: lines[i].slice(0, 500) });
        }
      }
    }
  }
  await walk(base);
  return { results, truncated: results.length >= maxResults };
}

class JobManager {
  constructor(config) { this.config = config; this.jobs = new Map(); }

  start(payload) {
    if (!this.config.allowTerminal) throw new Error('Terminal is disabled. Restart the agent with --allow-terminal to enable it.');
    const executable = String(payload.executable || '');
    if (!executable || executable.includes('/') || executable.includes('\\')) throw new Error('Executable must be a bare allow-listed command name.');
    if (!this.config.allowedExecutables.has(normalizeExecutable(executable))) throw new Error(`Executable is not allow-listed: ${executable}`);
    const args = Array.isArray(payload.args) ? payload.args.map(v => String(v)) : [];
    if (args.length > 100) throw new Error('Too many arguments.');
    const cwd = resolveExisting(this.config.workspace, payload.cwd || '.');
    if (!fs.statSync(cwd).isDirectory()) throw new Error('cwd is not a directory.');
    const timeoutSeconds = Math.max(1, Math.min(Number(payload.timeoutSeconds ?? 600), 3600));
    const id = randomToken(12);
    const job = {
      id, status: 'running', executable, args, cwd: relDisplay(this.config.workspace, cwd),
      startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, signal: null,
      stdout: '', stderr: '', truncated: false, child: null
    };
    const child = spawn(executable, args, { cwd, shell: false, windowsHide: true, env: process.env });
    job.child = child;
    const append = (key, chunk) => {
      const text = chunk.toString('utf8');
      job[key] += text;
      if (job[key].length > MAX_TEXT) { job[key] = job[key].slice(-MAX_TEXT); job.truncated = true; }
    };
    child.stdout?.on('data', c => append('stdout', c));
    child.stderr?.on('data', c => append('stderr', c));
    child.on('error', err => { job.status = 'failed_to_start'; job.stderr += String(err.stack || err); job.finishedAt = new Date().toISOString(); });
    child.on('close', (code, signal) => {
      if (job.status === 'running') job.status = 'finished';
      job.exitCode = code;
      job.signal = signal;
      job.finishedAt = new Date().toISOString();
      job.child = null;
    });
    job.timer = setTimeout(() => {
      if (job.status === 'running' && job.child) {
        job.status = 'timed_out';
        job.child.kill();
      }
    }, timeoutSeconds * 1000);
    job.timer.unref?.();
    this.jobs.set(id, job);
    return this.public(job);
  }

  get(id) {
    const job = this.jobs.get(String(id));
    if (!job) throw new Error('Unknown job id.');
    return this.public(job);
  }

  cancel(id) {
    const job = this.jobs.get(String(id));
    if (!job) throw new Error('Unknown job id.');
    if (job.status === 'running' && job.child) {
      job.status = 'cancelled';
      job.child.kill();
    }
    return this.public(job);
  }

  public(job) {
    return {
      id: job.id, status: job.status, executable: job.executable, args: job.args, cwd: job.cwd,
      startedAt: job.startedAt, finishedAt: job.finishedAt, exitCode: job.exitCode,
      signal: job.signal, stdout: job.stdout, stderr: job.stderr, truncated: job.truncated
    };
  }
}

function quickExec(config, executable, args, cwd = '.') {
  const absCwd = resolveExisting(config.workspace, cwd);
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd: absCwd, timeout: 12_000, windowsHide: true, maxBuffer: 70_000 }, (error, stdout, stderr) => {
      if (error && error.code === 'ENOENT') return reject(new Error(`${executable} is not installed or not on PATH.`));
      resolve({ exitCode: error && typeof error.code === 'number' ? error.code : 0, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

async function executeOperation(config, jobs, operation, payload = {}) {
  switch (operation) {
    case 'workspace.info':
      return {
        version: VERSION, workspace: config.workspace, workspaceName: path.basename(config.workspace),
        platform: process.platform, hostname: os.hostname(), terminalEnabled: config.allowTerminal,
        allowedExecutables: [...config.allowedExecutables].sort()
      };
    case 'workspace.tree':
      return tree(config, payload);
    case 'file.read': { 
      const abs = resolveExisting(config.workspace, payload.path);
      const text = await readTextFile(abs);
      const hash = sha256(text);
      const lines = text.split(/\r?\n/);
      const start = Math.max(1, Number(payload.startLine ?? 1));
      const end = Math.min(lines.length, Number(payload.endLine ?? Math.min(lines.length, start + 500)));
      let selected = lines.slice(start - 1, end).join('\n');
      const maxChars = Math.max(1000, Math.min(Number(payload.maxChars ?? 60_000), 75_000));
      const truncated = selected.length > maxChars;
      if (truncated) selected = selected.slice(0, maxChars);
      return { path: relDisplay(config.workspace, abs), sha256: hash, totalLines: lines.length, startLine: start, endLine: end, content: selected, truncated };
    }
    case 'file.search':
      return await searchFiles(config, payload);
    case 'file.create': {
      const abs = resolveForCreate(config.workspace, payload.path);
      if (fs.existsSync(abs) && !payload.overwrite) throw new Error('File already exists; set overwrite=true to replace it.');
      let snapshot = null;
      if (fs.existsSync(abs)) {
        const real = resolveExisting(config.workspace, payload.path);
        snapshot = await snapshotFile(config, real);
      }
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      const content = String(payload.content ?? '');
      await fsp.writeFile(abs, content, 'utf8');
      return { path: relDisplay(config.workspace, abs), bytes: Buffer.byteLength(content), sha256: sha256(content), snapshot };
    }
    case 'file.replace': {
      const abs = resolveExisting(config.workspace, payload.path);
      const text = await readTextFile(abs);
      const currentHash = sha256(text);
      if (payload.expectedSha256 && String(payload.expectedSha256) !== currentHash) {
        const err = new Error('FILE_CHANGED: expectedSha256 does not match current file. Re-read the file before editing.');
        err.code = 'FILE_CHANGED';
        err.currentSha256 = currentHash;
        throw err;
      }
      const oldText = String(payload.oldText ?? '');
      const newText = String(payload.newText ?? '');
      if (!oldText) throw new Error('oldText must not be empty.');
      const first = text.indexOf(oldText);
      if (first < 0) throw new Error('oldText was not found exactly in the file.');
      const second = text.indexOf(oldText, first + oldText.length);
      if (second >= 0 && !payload.replaceAll) throw new Error('oldText occurs more than once; provide a larger unique block or set replaceAll=true.');
      const snapshot = await snapshotFile(config, abs);
      const updated = payload.replaceAll ? text.split(oldText).join(newText) : text.slice(0, first) + newText + text.slice(first + oldText.length);
      await fsp.writeFile(abs, updated, 'utf8');
      return { path: relDisplay(config.workspace, abs), oldSha256: currentHash, sha256: sha256(updated), snapshot };
    }
    case 'file.delete': {
      const lexical = lexicalPath(config.workspace, payload.path);
      if (!fs.existsSync(lexical)) throw new Error('File does not exist.');
      const stat = await fsp.lstat(lexical);
      if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error('Only files or symlinks can be deleted by this operation.');
      if (stat.isFile() && payload.expectedSha256) {
        const real = resolveExisting(config.workspace, payload.path);
        const text = await readTextFile(real);
        if (sha256(text) !== String(payload.expectedSha256)) throw new Error('FILE_CHANGED: expectedSha256 does not match current file.');
      }
      const rel = path.relative(config.workspace, lexical);
      const trash = path.join(config.workspace, '.caya-agent', 'trash', timestamp(), rel);
      await fsp.mkdir(path.dirname(trash), { recursive: true });
      await fsp.rename(lexical, trash);
      return { deleted: relDisplay(config.workspace, lexical), recoverableAt: relDisplay(config.workspace, trash) };
    }
    case 'terminal.start':
      return jobs.start(payload);
    case 'terminal.result':
      return jobs.get(payload.jobId);
    case 'terminal.cancel':
      return jobs.cancel(payload.jobId);
    case 'git.status':
      return await quickExec(config, 'git', ['status', '--short', '--branch'], payload.cwd || '.');
    case 'git.diff': {
      const args = ['diff', '--no-ext-diff', '--'];
      if (payload.path) args.push(String(payload.path));
      return await quickExec(config, 'git', args, payload.cwd || '.');
    }
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

async function postJson(url, body, timeoutMs = 35_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': `CaYaAgent/${VERSION}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!response.ok) throw new Error(`Bridge ${response.status}: ${data?.error || text}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }
  const config = loadConfig(args);
  const jobs = new JobManager(config);

  console.log('');
  console.log(`CaYa Agent ${VERSION}`);
  console.log('='.repeat(58));
  console.log(`Workspace      : ${config.workspace}`);
  console.log(`Bridge         : ${config.bridge}`);
  console.log(`Terminal       : ${config.allowTerminal ? 'ENABLED (allow-listed)' : 'DISABLED'}`);
  console.log('');
  console.log('PAIRING CREDENTIALS — treat these as a temporary password');
  console.log(`Session ID     : ${config.sessionId}`);
  console.log(`Session Secret : ${config.sessionSecret}`);
  console.log('='.repeat(58));
  console.log('');

  const auth = { sessionId: config.sessionId, sessionSecret: config.sessionSecret };
  let registered = false;
  for (;;) {
    try {
      if (!registered) {
        await postJson(`${config.bridge}/internal/agent/register`, {
          ...auth,
          metadata: { version: VERSION, workspaceName: path.basename(config.workspace), platform: process.platform, terminalEnabled: config.allowTerminal }
        }, 15_000);
        registered = true;
        console.log('[connected] Registered with bridge.');
      }
      const polled = await postJson(`${config.bridge}/internal/agent/poll`, auth, 32_000);
      if (!polled?.task) continue;
      const { id, operation, payload } = polled.task;
      let result;
      try {
        const data = await executeOperation(config, jobs, operation, payload || {});
        result = { ...auth, taskId: id, ok: true, data };
      } catch (error) {
        result = {
          ...auth, taskId: id, ok: false,
          error: { message: String(error?.message || error), code: error?.code || 'AGENT_ERROR', currentSha256: error?.currentSha256 }
        };
      }
      await postJson(`${config.bridge}/internal/agent/result`, result, 15_000);
    } catch (error) {
      registered = false;
      const message = error?.name === 'AbortError' ? 'poll timeout' : String(error?.message || error);
      if (message !== 'poll timeout') console.error(`[bridge] ${message}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exitCode = 1;
});
