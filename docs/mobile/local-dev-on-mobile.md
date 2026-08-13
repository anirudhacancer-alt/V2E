# Local Dev on Mobile — Tailscale Setup

Last updated: `2026-03-24`

How to access the running V2E dev environment from a physical phone using
[Tailscale](https://tailscale.com). The same Vite and API processes that run
on the Mac are reachable at a stable HTTPS URL on any phone joined to the same
tailnet.

---

## Architecture

```
iPhone (Tailscale on)
   │  HTTPS  https://v2e.tail1239b8.ts.net/
   │
   ▼
Tailscale Service: svc:v2e  (tcp:443, TailVIP 100.122.13.102)
   │  routes to host: taruns-macbook-pro (tag:v2e-host)
   ▼
tailscale serve  (Tailscale TLS termination, port 443)
   │  proxy  http://127.0.0.1:3001
   ▼
apps/field-app  Vite dev server  :3001
   │  /v1, /uploads  proxy  http://127.0.0.1:3000
   ▼
apps/api  Hono dev server  :3000
```

Traffic never leaves the tailnet. Tailscale terminates TLS; Vite receives plain
HTTP on `127.0.0.1:3001`.

---

## One-time setup

### 1. Tailscale authtoken

```bash
ngrok config add-authtoken <token>      # needed only for ngrok, not Tailscale
```

For Tailscale the authtoken is stored by `tailscale login` (done interactively
from the Tailscale app). No extra CLI step needed.

### 2. Tag the Mac as a service host

Tailscale Services require the hosting device to use a **tag-based identity**
(not a user login). Run once on the Mac — this replaces the user identity on
the Tailscale side for this device:

```bash
tailscale up --advertise-tags=tag:v2e-host --reset
```

Verify:

```bash
tailscale status --json | python3 -c \
  "import sys,json; s=json.load(sys.stdin)['Self']; print('Tags:', s['Tags'])"
# Tags: ['tag:v2e-host']
```

### 3. Tailscale ACL policy

In **[Access controls](https://login.tailscale.com/admin/acls)**, add the tag
owner definition so `tag:v2e-host` can be assigned:

```json
"tagOwners": {
  "tag:v2e-host": ["autogroup:admin"]
}
```

The default `{"src": ["*"], "dst": ["*"], "ip": ["*"]}` grant is sufficient for
a dev tailnet. For a tighter policy add an explicit grant:

```json
"grants": [
  {
    "src": ["autogroup:member"],
    "dst": ["svc:v2e"],
    "ip": ["443"]
  }
]
```

### 4. Tailscale Service definition

In **[Services](https://login.tailscale.com/admin/services)** → **Define a
Service**:

| Field | Value |
|-------|-------|
| Name | `v2e` |
| Description | `voice-to-execution` |
| Endpoints | `tcp:443` |

> **Important:** the Endpoint field in the admin UI must match the port used
> in `tailscale serve` (`--https=443` advertises `tcp:443`). A mismatch
> produces *"Advertising the service, but some required ports are missing"*.

### 5. Vite config (already committed)

`apps/field-app/vite.config.ts` is configured with:

```ts
server: {
  port: 3001,
  host: true,          // bind to 0.0.0.0 so Tailscale IP reaches it
  allowedHosts: true,  // allow non-localhost Host headers from Tailscale
  proxy: {
    // Empty VITE_API_URL → /v1 requests hit Vite which forwards here
    "/v1": { target: "http://127.0.0.1:3000", changeOrigin: true },
    // Same-origin attachment URLs (/uploads/...) served by the API
    "/uploads": { target: "http://127.0.0.1:3000", changeOrigin: true },
  },
},
```

### 6. `.env.local` (already committed, gitignored)

`apps/field-app/.env.local`:

```env
# Empty VITE_API_URL → API calls use the Vite /v1 proxy above.
VITE_API_URL=
VITE_API_TOKEN=dev-token
```

This file is gitignored. Restore normal development by deleting it or setting
`VITE_API_URL=http://localhost:3000`.

---

## Running (every session)

### Terminal 1 — dev servers

```bash
cd /path/to/voice-to-execution
pnpm dev
# API listening on :3000
# Vite listening on :3001  (and on Tailscale IP 100.78.80.120:3001)
```

### Terminal 2 — Tailscale serve

```bash
tailscale serve --service=svc:v2e --https=443 127.0.0.1:3001
```

Expected output:

```
This machine is configured as a service proxy for svc:v2e, but approval from
an admin is required. Once approved, it will be available in your Tailnet as:

https://v2e.tail1239b8.ts.net/
|-- proxy http://127.0.0.1:3001
```

The `--service` flag makes it run in the background automatically.

### Admin UI — approve the host

First time (or after `tailscale serve clear`):

1. **[Services](https://login.tailscale.com/admin/services)** → **v2e**
2. Under **Hosts** find `taruns-macbook-pro` with status *Pending approval*
3. Click **Approve**

Status changes to **Online** (green dot). Done.

### On the iPhone

1. Open the **Tailscale** app → confirm it shows **Connected**.
2. Open Safari / Chrome and navigate to:
   ```
   https://v2e.tail1239b8.ts.net/
   ```

---

## Stopping

```bash
# Stop Tailscale serve for v2e
tailscale serve clear svc:v2e

# Stop dev servers (Ctrl-C in terminal 1, or)
kill $(lsof -t -i:3000) $(lsof -t -i:3001) 2>/dev/null
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERR_NAME_NOT_RESOLVED` on phone | Tailscale VPN not connected on phone | Open Tailscale app, tap **Connect** |
| `service hosts must be tagged nodes` | Mac is using a user identity | Run `tailscale up --advertise-tags=tag:v2e-host --reset` |
| *"Advertising the service, but some required ports are missing"* | Service endpoint (`tcp:3001`) doesn't match serve (`--https=443` = `tcp:443`) | Edit service in admin UI, change endpoint to `tcp:443` |
| *Pending approval* forever | Need to approve in admin UI | Services → v2e → Hosts → Approve |
| App loads but API calls fail (404/CORS) | `VITE_API_URL` is set to `http://localhost:3000` so the phone can't reach it | Ensure `apps/field-app/.env.local` has `VITE_API_URL=` (empty) and restart Vite |
| Images/audio from `/uploads/...` 404 on phone | API-only URLs without Vite proxy | Keep `VITE_API_URL=` so `/uploads` is proxied like `/v1` (see `apps/field-app/vite.config.ts`) |
| Vite shows only `localhost` in Network URLs | `host: true` missing from `vite.config.ts` | Already fixed in `vite.config.ts`; restart Vite |

---

## ngrok (alternative, no Tailscale on phone required)

ngrok exposes a **public** HTTPS URL — no Tailscale needed on the phone.

```bash
# One-time authtoken (free account)
ngrok config add-authtoken <token>

# Start tunnel (phone opens the URL printed below)
ngrok http 3001
```

Requirements:
- `apps/field-app/.env.local` with `VITE_API_URL=` (empty) so `/v1` goes through
  the Vite proxy (same as Tailscale setup above).
- `pnpm dev` running.

ngrok's free tier gives random URLs per session. Tailscale gives a stable URL
and keeps traffic private within the tailnet.

---

## Reference

| Resource | URL |
|----------|-----|
| Tailscale admin console | https://login.tailscale.com/admin |
| Services page | https://login.tailscale.com/admin/services |
| Access controls (ACL) | https://login.tailscale.com/admin/acls |
| DNS / MagicDNS | https://login.tailscale.com/admin/dns |
| Tailscale Services docs | https://tailscale.com/docs/features/tailscale-services |
| Tailscale Serve docs | https://tailscale.com/kb/1247/funnel-serve-use-cases |
| ngrok dashboard | https://dashboard.ngrok.com |
