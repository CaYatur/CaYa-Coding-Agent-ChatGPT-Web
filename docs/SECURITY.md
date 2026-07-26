# Security guide

CaYa Coding Agent can modify source files and, when terminal access is enabled, execute development tools on your computer. Treat it as a privileged development tool, not as a public unauthenticated demo API.

## Recommended baseline

- Run the local Agent as a normal OS user, **not Administrator/root**.
- Expose only a dedicated coding workspace.
- Keep terminal disabled unless you need build/test execution.
- Use a public **HTTPS** Bridge endpoint; never send session secrets over plain Internet HTTP.
- Prefer a Cloudflare/ngrok outbound tunnel or a remote Bridge over home router port-forwarding.
- Rotate the Agent session after accidental secret exposure.
- Do not store Session Secrets in repositories, screenshots, issue reports, or application logs.

## What the Session Secret protects

V1 generates a high-entropy Session ID and Session Secret at Agent startup.

The Bridge stores only a SHA-256 hash of the secret in memory. Each Agent/GPT request must present the matching session credentials.

This is **session authentication**, not full user identity. It is appropriate as a simple personal pairing mechanism, but it is not a replacement for OAuth in a multi-user hosted service.

## Workspace isolation

The Agent resolves requested paths against the selected workspace root. Existing symlinks are resolved and denied when they point outside the workspace.

Do not expose your entire user profile or system drive as the workspace. Prefer a project directory such as:

```text
C:\Projects\MyProject
```

rather than:

```text
C:\
```

or your complete home directory.

## Reversible writes

The current Agent attempts to make source changes recoverable:

- overwrites/replacements create snapshots under `.caya-agent/snapshots/`,
- deletes move files to `.caya-agent/trash/`,
- stale-file SHA-256 checks can prevent overwriting a file that changed after the GPT read it.

These mechanisms reduce risk; they are not a substitute for Git and normal backups.

## Terminal risk

`--allow-terminal` permits allow-listed development executables such as Node, npm, Python, dotnet, Git, Java, Cargo, Go, and build tools.

Even without a shell string, an interpreter/build tool can execute project-controlled code with the permissions of the user running the Agent. A malicious project can therefore be dangerous when built or tested.

Recommendations:

- use terminal access only on projects you trust,
- do not run the Agent elevated,
- keep the executable allow-list as small as practical,
- review unexpected install/build scripts before executing them,
- use a VM/container/isolated user account for untrusted repositories.

## Public Bridge exposure

The Bridge contains both public GPT Action endpoints and `/internal/agent/*` endpoints used by Agents. Session credentials protect the internal routes, but production operators should still:

- use HTTPS everywhere across untrusted networks,
- disable request-body logging in reverse proxies/observability tools,
- add rate limiting and abuse protection,
- keep the Bridge process patched,
- use firewall rules so the raw Bridge port is not publicly reachable when a reverse proxy/tunnel is used,
- keep only the reverse proxy/tunnel public.

## Data handling

The reference Bridge stores active sessions, pending tasks, and results in memory and does not intentionally persist source code or terminal output.

However, infrastructure around it may log or retain data:

- reverse proxies,
- CDN/tunnel providers,
- hosting platforms,
- process managers,
- observability/error-reporting services,
- ChatGPT/GPT Actions according to the user's OpenAI settings and policies.

Before hosting this for others, document exactly what your deployment collects and retains.

## Public GPTs and privacy

OpenAI currently requires a valid Privacy Policy URL for public GPTs that use Actions.

The Bridge `/privacy` page is a template only. Replace it with your real policy before publishing a GPT by link or in the GPT Store.

For multi-user deployments, add OAuth/device pairing so a user can authorize only their own connected machines instead of sharing raw session secrets in chat.

## Consequential Actions

The supplied OpenAPI schema marks file writes/deletes and terminal start/cancel operations as consequential. GPT Actions may require user confirmation for those calls.

Do not remove those flags simply to reduce prompts unless you understand the safety tradeoff.
