# GitHub release checklist

Before publishing a release:

## Repository

- [ ] `npm test` passes.
- [ ] `openapi/action.yaml` still contains `https://bridge.example.com`, not a private deployment URL.
- [ ] No real Session IDs or Session Secrets are committed.
- [ ] No personal IP addresses, private hostnames, or private source code are committed.
- [ ] `README.md`, `docs/GPT_SETUP.md`, and `docs/SELF_HOSTING.md` match the release behavior.
- [ ] `CHANGELOG.md` contains the release changes.

## Security

- [ ] Review `SECURITY.md` and `docs/SECURITY.md`.
- [ ] Do not publish a release binary that silently enables terminal access.
- [ ] If shipping `CaYaAgent.exe`, sign it when you have a suitable code-signing setup.
- [ ] Do not run the Bridge behind infrastructure that records request bodies containing session credentials/source code unless users are clearly informed.

## Public GPT / hosted service

These are only needed if **you** operate a GPT/backend for other people rather than asking each user to self-host:

- [ ] Real Privacy Policy URL.
- [ ] Operator/contact information.
- [ ] OAuth/device pairing instead of chat-visible long-term credentials.
- [ ] Per-user authorization and quotas.
- [ ] Durable session/device storage with defined retention/deletion.
- [ ] Abuse protection and monitoring with sensitive-field redaction.
- [ ] Shared state/queue if running multiple Bridge replicas.

## Release notes

Tell users clearly that:

- this is an early reference implementation,
- the Agent only accesses the selected workspace,
- terminal access is optional and must be explicitly enabled,
- a public HTTPS Bridge is required for GPT Actions,
- creating one's own Custom GPT currently depends on ChatGPT account eligibility.
