# Architecture

```text
ChatGPT / Custom GPT
        |
        | GPT Action: HTTPS JSON
        v
Public CaYa Bridge (port 443 via reverse proxy)
        |
        | queued request / result correlation
        v
Long-polling outbound HTTPS connection
        |
        v
CaYa Agent on the user's PC
        |
        +-- explicitly selected workspace
        +-- file read/search/create/replace/trash
        +-- optional allow-listed processes
        +-- read-only git status/diff helpers
```

The PC never needs an inbound port. `CaYaAgent` initiates all network connections to the bridge.

## Why long polling instead of WebSockets?

The reference implementation intentionally uses only Node.js built-ins. The agent holds an outbound POST poll for up to 25 seconds. An Action request received by the bridge is queued and delivered to the next active poll. Results are correlated by a random task id.

This can later be replaced with WebSockets without changing the public Action API.

## Session model

On every agent start, random credentials are generated unless fixed test credentials are supplied:

- session id: 128 random bits
- session secret: 256 random bits

The bridge stores only SHA-256 of the secret in memory. A session is considered stale after two hours without agent activity. Restarting the bridge clears all sessions.

This is intentionally a V1 pairing model. A production multi-user service should add user accounts/OAuth, persistence, revocation, audit controls, and abuse protection.

## Filesystem boundary

The agent resolves both lexical paths and real filesystem paths. Existing symlinks that resolve outside the selected workspace are rejected. Directory traversal (`..`) outside the root is rejected.

`.caya-agent/` is reserved for reversible snapshots and trash.

## Editing model

`file.replace` performs exact-text replacement. The model should first read the file and pass back the SHA-256 as `expectedSha256`. If the user or editor changed the file in the meantime, the operation fails with `FILE_CHANGED`.

## Terminal model

Terminal execution is disabled by default. The user must start the local agent with `--allow-terminal` or enable it in the local config.

Even then:
- no shell command string is accepted;
- the executable must be a bare name from the local allow-list;
- arguments are an array;
- the working directory must resolve inside the workspace.

Important: build tools and interpreters can themselves execute project code. Enabling terminal access therefore gives the connected coding agent materially more power than file editing alone. Use it only for workspaces you trust.

## GPT Action constraints

The Action-facing methods return quickly for file operations. Long commands are started asynchronously and return a job id. The GPT then checks job status separately. This keeps each HTTPS round trip comfortably below the Action timeout.
