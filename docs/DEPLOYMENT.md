# Deployment notes

The Bridge intentionally speaks plain HTTP so TLS termination can be provided by the deployment you choose.

For a full setup guide, use:

- [SELF_HOSTING.md](SELF_HOSTING.md) — Cloudflare Tunnel, ngrok, VPS, Nginx, Caddy, Apache, and existing-site path proxy examples.
- [SECURITY.md](SECURITY.md) — hardening and data-handling considerations.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — 502/504, session, timeout, and GPT schema debugging.

## Production shape

```text
ChatGPT GPT Action
       |
       | HTTPS :443 / TLS 1.2+
       v
reverse proxy / tunnel
       |
       v
127.0.0.1:8787 Bridge
       ^
       |
 outbound HTTPS/HTTP depending on topology
       |
Local Agent
```

Recommended properties:

- Bind the raw Bridge to loopback/private interfaces whenever possible.
- Publicly expose only the HTTPS reverse proxy/tunnel.
- Do not log Action/Agent request bodies; they can contain source code and session secrets.
- Use proxy timeouts long enough for the Bridge's normal long-poll/action behavior; 60 seconds is a reasonable starting point for this reference build.
- Use a valid public certificate.
- Keep public Action payloads under OpenAI's current limits.
- Add OAuth/device pairing and stronger quotas before operating a multi-user service.
- The current Bridge keeps sessions/queues in memory. Do not run multiple independent Bridge replicas behind a load balancer without replacing that state with a shared store/broker.
