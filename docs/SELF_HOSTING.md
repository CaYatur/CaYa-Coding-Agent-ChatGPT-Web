# Self-hosting, HTTPS, tunnels, and reverse proxies

GPT Actions cannot call `localhost` on your computer. They call a public API over the Internet. For CaYa Coding Agent, that public API is the **Bridge**.

OpenAI's current GPT Actions production requirements include public HTTPS with TLS 1.2+ on port 443 and a valid certificate. This guide shows several ways to provide that endpoint.

## Recommended topology

For most users, choose one of these:

### Simplest: Bridge + Agent on your PC, public HTTPS through a tunnel

```text
ChatGPT
   |
   | HTTPS
   v
Cloudflare Tunnel / ngrok
   |
   v
127.0.0.1:8787 Bridge
   ^
   |
127.0.0.1 Agent
   |
workspace
```

No router port-forward is required.

### More reliable: Bridge on a VPS/server, Agent on your PC

```text
ChatGPT ---> HTTPS ---> VPS Bridge
                         ^
                         |
                  outbound HTTPS
                         |
                    Local Agent
                         |
                     workspace
```

The local PC still needs no inbound port.

---

# Option A — Cloudflare Tunnel

Cloudflare Tunnel creates outbound connections from `cloudflared` to Cloudflare and maps a public hostname to a local service. This is usually the easiest way to expose a local Bridge without opening a router port.

## A1. Quick Tunnel — testing only

Start the Bridge:

```powershell
$env:HOST="127.0.0.1"
$env:PORT="8787"
node .\bridge\server.js
```

Then run:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Cloudflare prints a temporary URL similar to:

```text
https://random-words.trycloudflare.com
```

Use that exact URL in your GPT Action schema:

```yaml
servers:
  - url: https://random-words.trycloudflare.com
```

Health check:

```text
https://random-words.trycloudflare.com/health
```

Quick Tunnels are intended for testing. The hostname is temporary, so you may need to update your GPT schema when it changes.

## A2. Named Tunnel — stable hostname

For a stable setup:

1. Put your domain on Cloudflare.
2. Open the Cloudflare dashboard.
3. Go to **Networking → Tunnels**.
4. Create a Tunnel.
5. Install/run `cloudflared` using the command Cloudflare provides.
6. Add a **Published application** route.
7. Example public hostname:

   ```text
   agent.example.com
   ```

8. Service URL:

   ```text
   http://127.0.0.1:8787
   ```

Your Action base URL becomes:

```text
https://agent.example.com
```

When Bridge and Agent are on the same machine, the Agent itself can still use:

```text
http://127.0.0.1:8787
```

Only the GPT Action needs the public tunnel URL.

---

# Option B — ngrok

ngrok can expose a local HTTP service through an outbound encrypted tunnel and provide a public HTTPS URL.

Start the Bridge:

```powershell
$env:HOST="127.0.0.1"
$env:PORT="8787"
node .\bridge\server.js
```

Run:

```bash
ngrok http 8787
```

Use the HTTPS forwarding URL shown by ngrok as the Action server URL.

This is convenient for development and debugging. For a long-running production-like setup, use a stable reserved/custom hostname according to your ngrok plan or use a stable reverse-proxy/VPS deployment.

---

# Option C — Existing VPS/server with Nginx

This is a good choice when you already have a Linux server and domain.

Run the Bridge on loopback only:

```bash
HOST=127.0.0.1 PORT=8787 node bridge/server.js
```

## C1. Dedicated subdomain

Public URL:

```text
https://agent.example.com
```

Nginx server snippet:

```nginx
server {
    listen 443 ssl;
    server_name agent.example.com;

    # Configure your TLS certificate as appropriate for your server.

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_buffering off;
    }
}
```

The OpenAPI server URL is:

```yaml
servers:
  - url: https://agent.example.com
```

## C2. Reuse an existing website path

Suppose you already serve:

```text
https://example.com/
```

and want CaYa Bridge at:

```text
https://example.com/caya-agent/
```

Add this to the existing HTTPS `server` block:

```nginx
location /caya-agent/ {
    proxy_pass http://127.0.0.1:8787/;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
    proxy_buffering off;
}
```

The trailing slash in:

```nginx
proxy_pass http://127.0.0.1:8787/;
```

is intentional: it lets `/caya-agent/health` reach the Bridge as `/health`, and `/caya-agent/v1/...` reach it as `/v1/...`.

OpenAPI:

```yaml
servers:
  - url: https://example.com/caya-agent
```

Validate and reload Nginx using the commands appropriate for your distribution, for example:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Your main website remains on its existing routes; only `/caya-agent/` is proxied to the Bridge.

A ready-made snippet is also available at [`../examples/nginx-path.conf`](../examples/nginx-path.conf).

---

# Option D — Caddy

Caddy can act as a reverse proxy and automatically manage HTTPS for public hostnames when DNS/ports are configured correctly.

## Dedicated subdomain

```caddyfile
agent.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

## Existing site path

Merge a route such as this into your existing Caddyfile:

```caddyfile
example.com {
    handle_path /caya-agent/* {
        reverse_proxy 127.0.0.1:8787
    }

    # Your existing site handlers go here.
}
```

`handle_path` strips the matched prefix, which is what the Bridge expects.

See [`../examples/Caddyfile`](../examples/Caddyfile).

---

# Option E — Apache HTTP Server

Apache can reverse-proxy only the CaYa path while leaving the rest of your website untouched.

Example inside the HTTPS virtual host:

```apache
ProxyPreserveHost On
ProxyTimeout 60

ProxyPass        "/caya-agent/" "http://127.0.0.1:8787/"
ProxyPassReverse "/caya-agent/" "http://127.0.0.1:8787/"
```

Make sure the required proxy modules are enabled for your Apache installation.

OpenAPI:

```yaml
servers:
  - url: https://example.com/caya-agent
```

See [`../examples/apache-path.conf`](../examples/apache-path.conf).

---

# Option F — Bridge on a VPS, Agent at home

This is the most predictable architecture for continuous use.

On the VPS:

```bash
HOST=127.0.0.1 PORT=8787 node /opt/CaYaCodingAgent/bridge/server.js
```

Put Nginx/Caddy/Apache in front of it and expose:

```text
https://agent.example.com
```

On your PC:

```powershell
node .\agent\index.js `
  --bridge "https://agent.example.com" `
  --workspace "C:\Projects\MyProject" `
  --allow-terminal
```

The Agent makes outbound HTTPS requests to the VPS. You do not need a port-forward on the home router.

For Linux, an example systemd unit is provided at [`../examples/caya-bridge.service`](../examples/caya-bridge.service).

---

# Direct public port-forwarding — why it is not recommended

You can technically expose a home-hosted Bridge through a public IP, reverse proxy, certificate, and router port-forward. For this project it is usually the least attractive option because:

- your home IP/host is directly exposed,
- firewall/router configuration becomes part of the security boundary,
- certificates and HTTPS still need to be handled,
- CGNAT may make inbound connections impossible,
- tunnels already avoid all of those problems for many users.

Prefer an outbound tunnel or a remote Bridge.

---

# Timeouts

GPT Actions currently have a 45-second round-trip limit. The Bridge itself uses shorter internal timeouts, and the Agent long-polls for work.

Your reverse proxy should not terminate these normal requests too early. A **60-second proxy read/send timeout** is a reasonable starting point for this reference implementation.

Long build/test tasks are not held open in one Action request. They run as jobs:

```text
startWorkspaceCommand -> job id
getWorkspaceCommandResult -> running/finished + output
```

---

# Required health tests

Before configuring the GPT, verify:

```text
https://YOUR_PUBLIC_BASE/health
```

Expected:

```json
{
  "ok": true,
  "service": "CaYa Bridge",
  "version": "0.1.1",
  "onlineSessions": 1
}
```

Then test the Action path using the GPT editor or the commands in [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
