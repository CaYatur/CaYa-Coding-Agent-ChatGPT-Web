# Create your own Custom GPT

This guide connects **your own Custom GPT** to **your own CaYa Bridge**. No CaYa-hosted backend is required.

## Before you start

You need:

1. A running CaYa Bridge.
2. A **public HTTPS base URL** that reaches that Bridge.
3. A local CaYa Agent connected to the same Bridge.
4. A ChatGPT account that can create/edit GPTs.

As of July 2026, OpenAI documents GPT creation/editing as a web feature for paid ChatGPT users and eligible managed-workspace users. Using a GPT and creating a GPT are separate capabilities.

OpenAI also requires GPT Action endpoints to use public HTTPS/TLS 1.2+ on port 443 with a valid certificate. See [SELF_HOSTING.md](SELF_HOSTING.md) if you do not have that yet.

---

## 1. Start the Bridge

Local example:

```powershell
$env:HOST="127.0.0.1"
$env:PORT="8787"
node .\bridge\server.js
```

Health check:

```text
http://127.0.0.1:8787/health
```

Expected:

```json
{
  "ok": true,
  "service": "CaYa Bridge",
  "version": "0.1.1",
  "onlineSessions": 0
}
```

Then publish it through HTTPS, for example:

```text
https://agent.example.com
```

Public health check:

```text
https://agent.example.com/health
```

If you are integrating into an existing website using a path, your public URL might instead be:

```text
https://example.com/caya-agent
```

and the health endpoint becomes:

```text
https://example.com/caya-agent/health
```

The reverse proxy must strip `/caya-agent/` before forwarding requests to the Bridge. Examples are in [SELF_HOSTING.md](SELF_HOSTING.md).

---

## 2. Start the local Agent

### Bridge and Agent on the same PC

If a tunnel/reverse proxy exposes the local Bridge, the Agent can still connect over localhost:

```powershell
node .\agent\index.js `
  --bridge "http://127.0.0.1:8787" `
  --workspace "C:\Projects\MyProject"
```

### Bridge on a VPS/server

Use the public bridge URL:

```powershell
node .\agent\index.js `
  --bridge "https://agent.example.com" `
  --workspace "C:\Projects\MyProject"
```

### Enable build/test commands

```powershell
node .\agent\index.js `
  --bridge "https://agent.example.com" `
  --workspace "C:\Projects\MyProject" `
  --allow-terminal
```

The Agent displays:

```text
Session ID     : ...
Session Secret : ...
```

Treat the Session Secret as a temporary password.

---

## 3. Prepare the OpenAPI schema

The repository includes a GPT-editor-compatible schema:

```text
openapi/action.yaml
```

Change its server URL:

```yaml
servers:
  - url: https://bridge.example.com
```

For a dedicated subdomain:

```yaml
servers:
  - url: https://agent.example.com
```

For an existing site with a path proxy:

```yaml
servers:
  - url: https://example.com/caya-agent
```

Or generate it automatically:

```bash
node tools/prepare-action-schema.mjs https://agent.example.com
```

Output:

```text
openapi/action.generated.yaml
```

### Why the schema is intentionally verbose

The current GPT Actions editor can be stricter than a general OpenAPI validator. The included schema intentionally keeps request and response object properties inline instead of relying heavily on `$ref`/`allOf` composition. Use the supplied schema first before trying to simplify it.

---

## 4. Create the GPT

In ChatGPT on the web:

1. Open **Explore GPTs**.
2. Select **Create**.
3. Open the configuration view.
4. Give the GPT a name, for example `My Coding Agent`.
5. Paste [`../gpt/instructions.md`](../gpt/instructions.md) into **Instructions**.
6. Find **Actions** and select **Create new action**.

A GPT can use Actions to call external APIs defined by an OpenAPI schema.

---

## 5. Choose authentication

### V1 personal/self-hosted setup: `None`

Choose:

```text
Authentication: None
```

CaYa Agent V1 authenticates each connected device session using the temporary `sessionId` + `sessionSecret` inside the JSON request.

This is easy for personal use, but it means the session secret is supplied to the GPT conversation. Do not use a secret that you reuse anywhere else.

### Shared/public service: OAuth is recommended

If you are building a service for many users, do not depend on chat-visible pairing secrets as your long-term identity system. GPT Actions support OAuth, which lets each user sign in and sends their token with Action requests.

The current reference Bridge does **not** implement OAuth. It is a future production-hardening step.

---

## 6. Paste the Action schema

Paste the contents of your edited/generated YAML into the Action schema field.

The editor should detect these operations:

```text
getWorkspaceInfo
getWorkspaceTree
readWorkspaceFile
searchWorkspaceText
createWorkspaceFile
replaceWorkspaceText
deleteWorkspaceFile
startWorkspaceCommand
getWorkspaceCommandResult
cancelWorkspaceCommand
getGitStatus
getGitDiff
```

There should be no schema validation errors.

If you see errors such as:

```text
request body schema is not an object schema
```

or:

```text
object schema missing properties
```

make sure you are using the current `openapi/action.yaml` from this repository rather than an older schema.

---

## 7. Test the Action before chatting

Use the **Test** button beside `getWorkspaceInfo`.

Supply the current Agent credentials:

```json
{
  "sessionId": "YOUR_SESSION_ID",
  "sessionSecret": "YOUR_SESSION_SECRET"
}
```

Expected response shape:

```json
{
  "ok": true,
  "data": {
    "workspace": "C:\\Projects\\MyProject",
    "workspaceName": "MyProject",
    "platform": "win32",
    "terminalEnabled": false
  }
}
```

If you get `SESSION_OFFLINE`, the Agent is not registered with the Bridge URL used by the GPT. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## 8. Pair in a normal GPT conversation

Start a new conversation with your GPT and provide the temporary credentials:

```text
Connect to this CaYa Agent session for this conversation.

Session ID: <id>
Session Secret: <secret>

Start by calling getWorkspaceInfo and then inspect the project tree.
```

Do not publish those credentials or paste them into GitHub issues.

---

## 9. First write test

Ask:

```text
Create caya-action-test.txt in the workspace root with this text:
Hello from my Custom GPT.
Then read the file back and verify it.
```

The GPT should call `createWorkspaceFile`, then `readWorkspaceFile`.

---

## 10. First coding-agent loop

With terminal enabled:

```text
Inspect this project, run the smallest appropriate build or test command,
fix the first real code error you find, inspect the diff, and run the test again.
Do not claim success unless the command exits successfully.
```

The expected workflow is:

```text
workspace info/tree
      ↓
read/search source
      ↓
read file + keep SHA-256
      ↓
replace exact block
      ↓
git diff
      ↓
start build/test job
      ↓
poll result
      ↓
fix again if needed
```

---

## 11. Privacy Policy for public GPTs

OpenAI currently requires a valid Privacy Policy URL for public GPTs that use Actions.

The reference Bridge exposes:

```text
/privacy
```

but that page is only a template. Before sharing a GPT publicly, replace it with your actual operator identity/contact information, what data you receive, what you log/store, retention/deletion behavior, and hosting-provider details.

For a personal GPT kept private, still read the privacy/security implications in [SECURITY.md](SECURITY.md).
