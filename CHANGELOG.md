# Changelog

## 0.1.1

- Fixed long-poll waiter cleanup that could cause Bridge → Agent tasks to time out.
- Added clearer Bridge task/result logging for debugging.
- Reworked the GPT Actions OpenAPI schema for stricter GPT editor compatibility.
- Added self-hosting documentation for Cloudflare Tunnel, ngrok, Nginx, Caddy, Apache, VPS deployments, and existing-site path proxies.
- Added Custom GPT setup, security, troubleshooting, official references, and Turkish quick-start documentation.
- Added `prepare-action-schema.mjs` to generate a schema with a custom HTTPS Bridge URL.

## 0.1.0

- Initial reference implementation.
- Workspace tree/read/search/create/replace/delete operations.
- SHA-256 stale-file protection and recoverable snapshots/trash.
- Optional allow-listed terminal jobs.
- Read-only Git status/diff operations.
- End-to-end bridge/agent test.
