# Troubleshooting

Use this order when debugging:

```text
1. Bridge local health
2. Agent registration
3. Local Bridge -> Agent API call
4. Public HTTPS health
5. Public Action API call
6. Custom GPT Action test
```

This separates local Agent bugs from reverse-proxy/tunnel problems.

---

## 1. Check the Bridge

Open:

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

After the Agent registers, `onlineSessions` should be at least `1`.

---

## 2. `SESSION_OFFLINE`

Example:

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_OFFLINE",
    "message": "Unknown or offline session."
  }
}
```

Check:

- Is the Agent still running?
- Is the Session ID from the current Agent run?
- Is the Agent connected to the **same Bridge instance** that the GPT Action calls?
- Did the Bridge restart? V1 session state is in memory, so a Bridge restart requires the Agent to register again.

---

## 3. `BAD_SECRET`

The Session ID exists, but the Session Secret is wrong.

Restart the Agent if the secret was exposed and use the new pair.

---

## 4. `AGENT_TIMEOUT`

This means the Bridge accepted the Action call and found the session, but did not receive the Agent result before the Bridge timeout.

First bypass every proxy and test locally.

PowerShell:

```powershell
$body = @{
  sessionId = "YOUR_SESSION_ID"
  sessionSecret = "YOUR_SESSION_SECRET"
} | ConvertTo-Json

(Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8787/v1/workspace/info" `
  -ContentType "application/json" `
  -Body $body) | ConvertTo-Json -Depth 10
```

A healthy call should return quickly.

Bridge v0.1.1 fixed long-poll waiter cleanup issues that could cause tasks to be swallowed. Make sure your `bridge/server.js` reports v0.1.1 or newer.

Useful Bridge logs look like:

```text
agent registered ...
task ... workspace.info -> waiting agent ...
agent ... received task ... workspace.info
result ... workspace.info ... ok=true in 15ms
```

If the local request times out, the problem is Bridge ↔ Agent, not Cloudflare/Nginx/ChatGPT.

---

## 5. 502 Bad Gateway

A 502 from your public hostname usually means the reverse proxy cannot reach the Bridge.

Check from the reverse-proxy machine:

```bash
curl http://127.0.0.1:8787/health
```

or, if the Bridge is on another private host:

```bash
curl http://PRIVATE_IP:8787/health
```

Verify:

- Bridge is listening on the expected interface/port,
- firewall permits the proxy-to-Bridge connection,
- reverse-proxy upstream host/port is correct.

---

## 6. 504 Gateway Timeout

If local `workspace/info` works but the public request gives 504:

- raise reverse-proxy upstream/read/send timeout to around 60 seconds,
- verify no CDN/WAF rule terminates the request early,
- verify path rewriting sends the request to the correct Bridge route.

`getWorkspaceInfo` itself should normally return quickly. A long wait on this operation often indicates a routing or Agent communication problem rather than a genuinely slow task.

---

## 7. `/health` works but Actions return 404

This is commonly a **base-path rewrite** mismatch.

Suppose the OpenAPI schema has:

```yaml
servers:
  - url: https://example.com/caya-agent
```

Then ChatGPT calls:

```text
https://example.com/caya-agent/v1/workspace/info
```

Your proxy must forward that to the Bridge as:

```text
/v1/workspace/info
```

For Nginx, use:

```nginx
location /caya-agent/ {
    proxy_pass http://127.0.0.1:8787/;
}
```

Note both trailing slashes.

---

## 8. GPT editor: `request body schema is not an object schema`

Use the current repository `openapi/action.yaml`.

Older versions used `allOf` + `$ref` composition. Although legal OpenAPI patterns, the GPT Actions editor may reject them in this context.

The current schema keeps request objects inline.

---

## 9. GPT editor: `object schema missing properties`

Again, use the current `openapi/action.yaml`.

Every object response in the current schema explicitly contains a `properties` map to satisfy the GPT Actions schema parser.

---

## 10. Public health works in your browser but ChatGPT sees an old error

CDNs and fetch layers can temporarily preserve an older response.

For health diagnostics only, try a cache-busting query:

```text
https://agent.example.com/health?cb=1
```

The Bridge itself returns `Cache-Control: no-store`, but intermediate infrastructure can still have its own behavior/configuration.

---

## 11. Terminal says disabled

Start the Agent with:

```text
--allow-terminal
```

The GPT cannot turn terminal access on remotely.

---

## 12. `Executable is not allowed`

The Agent uses an executable allow-list. Edit `agent/config.example.json` into your own config or use the supported configuration mechanism to add only the tools you actually need.

Do not solve this by allowing a general shell such as unrestricted `cmd.exe`/PowerShell for a public deployment.

---

## 13. Action works in curl/Postman but not in GPT

Use the **Test** button in the GPT Action editor. OpenAI's editor provides the actual Action input/output and is the best place to catch:

- wrong server base URL,
- missing parameters,
- schema parsing issues,
- authentication configuration mistakes.

Also remember the current platform limits: public HTTPS/TLS, text-only payloads, sub-100k request/response bodies, and 45-second Action round trips.
