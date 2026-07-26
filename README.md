# CaYa Coding Agent ChatGPT Web

CaYa Coding Agent is a self-hostable bridge that lets a **Custom GPT Action** operate on one explicitly selected coding workspace on your computer.

The project has two processes:

- **Bridge** — a small HTTP API that GPT Actions call.
- **Agent** — runs on your computer, connects outbound to the bridge, and performs the allowed workspace operations.

The local Agent never needs to expose an inbound port when you use a tunnel or a remote bridge.

> **Status: v0.1.1 — reference implementation / early MVP.** The core bridge ↔ agent workflow is tested, including file reads/writes, stale-file protection, terminal jobs, and recoverable deletion. Review the security notes before using it with important projects.

## What it can do

- Inspect a workspace tree and capabilities
- Read text files by line range with SHA-256 metadata
- Search text across source files
- Create files and overwrite with snapshots
- Replace exact code blocks with stale-file protection
- Move deleted files into `.caya-agent/trash/`
- Optionally run allow-listed build/test executables
- Poll and cancel long-running command jobs
- Read `git status` and `git diff`
- Run without third-party npm dependencies

## Architecture

```text
                   ChatGPT Custom GPT
                          |
                    GPT Actions
                     HTTPS :443
                          |
                          v
                 Public Bridge URL
                          |
                  task/result relay
                          |
                          v
                 CaYa Agent on PC
                          |
                          v
                selected workspace only
```

A common self-hosted layout is:

```text
ChatGPT
   |
   | HTTPS
   v
agent.example.com  --->  reverse proxy / tunnel  --->  Bridge :8787
                                                        ^
                                                        |
                                                outbound connection
                                                        |
                                                   Local Agent
                                                        |
                                                   MyProject/
```

## Choose a deployment model

| Model | Public VPS needed? | Router port-forward? | Best for |
|---|---:|---:|---|
| **Cloudflare Tunnel + bridge on your PC** | No | No | Easiest self-hosted setup |
| **ngrok + bridge on your PC** | No | No | Fast temporary testing |
| **Bridge on a VPS/server + local Agent** | Yes | No | Reliable long-running use |
| **Existing website + reverse-proxy path** | Existing server | No for local Agent | Reusing your current HTTPS site |
| **Direct public port from home** | No | Usually yes | Not recommended |

See **[Self-hosting and HTTPS](docs/SELF_HOSTING.md)** for step-by-step instructions and Nginx, Caddy, Apache, Cloudflare Tunnel, and ngrok examples.

## Requirements

### Agent

- Node.js 22+ when running from source
- Windows, macOS, or Linux
- A folder you explicitly choose as the coding workspace

### Bridge

- Node.js 22+
- For GPT Actions: a **public HTTPS URL with a valid certificate on port 443**

No `npm install` is required for the current source tree.

## 5-minute local test

Start the Bridge:

```powershell
cd CaYaCodingAgent
$env:HOST="127.0.0.1"
$env:PORT="8787"
node .\bridge\server.js
```

Start the Agent in another terminal:

```powershell
node .\agent\index.js `
  --bridge "http://127.0.0.1:8787" `
  --workspace "C:\Projects\MyProject"
```

Enable build/test commands only when needed:

```powershell
node .\agent\index.js `
  --bridge "http://127.0.0.1:8787" `
  --workspace "C:\Projects\MyProject" `
  --allow-terminal
```

The Agent prints a temporary **Session ID** and **Session Secret**. Treat the secret like a password.

Run the included end-to-end test:

```bash
npm test
```

## Make the Bridge reachable by GPT Actions

`localhost`, private LAN addresses such as `192.168.x.x`, and plain HTTP are not suitable as the GPT Action endpoint. The Action endpoint must be public HTTPS.

The easiest development option is Cloudflare Quick Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

This returns a temporary public HTTPS hostname. For a stable setup, create a named Cloudflare Tunnel or deploy the Bridge behind Nginx/Caddy/Apache on your own server.

Detailed alternatives: **[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)**.

## Create your own Custom GPT

> **Current ChatGPT requirement:** creating/editing GPTs is available in the ChatGPT web experience to paid users and eligible managed-workspace users. If your account cannot create GPTs, you cannot use the self-created GPT path described here unless OpenAI changes that availability.

1. Open **Explore GPTs → Create** in ChatGPT on the web.
2. Open the GPT configuration view.
3. Under **Actions**, create a new action.
4. For this V1 single-user setup choose **Authentication: None**. The temporary `sessionSecret` authenticates the Agent session inside the request body.
5. Copy [`openapi/action.yaml`](openapi/action.yaml).
6. Replace:

   ```yaml
   servers:
     - url: https://bridge.example.com
   ```

   with your real public bridge base URL, for example:

   ```yaml
   servers:
     - url: https://agent.example.com
   ```

   or, when your existing website proxies a path to the Bridge:

   ```yaml
   servers:
     - url: https://example.com/caya-agent
   ```

7. Paste [`gpt/instructions.md`](gpt/instructions.md) into the GPT Instructions field.
8. Test `getWorkspaceInfo` from the Action editor.
9. Pair the GPT using the Session ID and Session Secret shown by your local Agent.

Full walkthrough: **[docs/GPT_SETUP.md](docs/GPT_SETUP.md)**.

You can also generate a ready-to-paste schema with your URL:

```bash
node tools/prepare-action-schema.mjs https://agent.example.com
```

The generated file is written to `openapi/action.generated.yaml`.

## Example usage

After pairing:

```text
Inspect the project and tell me what stack it uses.
```

```text
Find the TypeScript build error, make the smallest safe fix, then run the build again.
```

```text
Create src/hello.js that prints "Hello from CaYa Agent", run it, and show me the result.
```

For existing files, the GPT instructions tell the model to read the file first, keep the returned SHA-256, make a focused replacement, inspect the diff, and then test.

## Important GPT Actions constraints

The current GPT Actions platform requires:

- TLS 1.2+ over public HTTPS on port 443
- valid public certificates
- request/response payloads below 100,000 characters
- text-only requests/responses
- a 45-second round-trip limit per Action call

CaYa Coding Agent therefore runs terminal commands as asynchronous jobs: `startWorkspaceCommand` returns a job id immediately, and the GPT polls `getWorkspaceCommandResult` afterward.

## Security model

### Workspace boundary

The Agent is limited to the workspace selected at launch. Existing filesystem symlinks are resolved and rejected if they escape that root.

### Reversible changes

Existing files are snapshot before overwrite/replace operations. Deletes are moved to `.caya-agent/trash/` rather than permanently removed.

### Stale-file protection

`readWorkspaceFile` returns a SHA-256 hash. `replaceWorkspaceText` can require that hash so a file changed after the GPT read it is not silently overwritten.

### Terminal is opt-in

Terminal access is disabled unless you launch with `--allow-terminal`. Commands use `spawn(..., { shell: false })`, and executable names must be in the Agent allow-list.

Build tools and interpreters can execute project code with the permissions of your OS account. **Do not run the Agent as Administrator/root, and enable terminal only for workspaces you trust.**

### Pairing secret

The V1 Session Secret is a temporary password. Do not post it in GitHub issues, screenshots, logs, or public chats. Restarting the Agent creates a new session.

For a real multi-user public service, use OAuth/device pairing rather than asking users to paste secrets into conversations.

Read **[docs/SECURITY.md](docs/SECURITY.md)** before exposing the bridge publicly.

## Public/shared GPTs

This repository is designed primarily for **self-hosting**: each operator owns their Bridge URL and GPT configuration.

You can build a shared GPT for many users, but then you are operating a public service and should add at minimum:

- OAuth/device pairing
- durable user/session storage
- per-user authorization and quotas
- abuse protection and observability with sensitive-body redaction
- a real privacy policy and operator contact details
- a shared queue/store before running multiple Bridge instances

OpenAI currently requires a valid Privacy Policy URL for public GPTs that use Actions.

## Project layout

```text
agent/                 local workspace agent
bridge/                public relay/API
openapi/action.yaml    GPT Actions schema
gpt/instructions.md    suggested Custom GPT instructions
docs/                  setup, hosting, security, troubleshooting
examples/              reverse-proxy/service examples
tests/                 end-to-end tests
tools/                 helper scripts
```

## Documentation

- [Create and configure your Custom GPT](docs/GPT_SETUP.md)
- [Self-hosting, HTTPS, tunnels, and reverse proxies](docs/SELF_HOSTING.md)
- [Security and production hardening](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Official references](docs/REFERENCES.md)
- [Türkçe hızlı başlangıç](docs/QUICKSTART_TR.md)

## Windows single executable

A helper is included at:

```text
tools/build-agent-single-exe.ps1
```

It targets Node.js' Single Executable Application workflow to produce `dist/CaYaAgent.exe`. Release binaries are unsigned unless you sign them yourself.

## License

MIT
