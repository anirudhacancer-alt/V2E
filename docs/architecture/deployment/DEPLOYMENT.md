---
last_changes: "Frontmatter refresh (pre-commit last_updated window)."
last_updated: "2026-03-27T03:56:00Z"
---

# Deployment Notes

This file is the practical deployment note for:

- web deployment
- API deployment
- AI gateway dependency
- `@enact-ui/*` packaging
- future Capacitor/mobile deployment

## Short answers

### Does ignoring generated `.js` / `.d.ts` files affect deployment?

No.

Those files under `packages/contracts/src/` are source-side build artifacts and should not be the deployment mechanism. Deployment should build fresh outputs into each package's `dist/` during CI or inside the container image.

Ignoring them is the correct move.

### Can we deploy to Azure Container Apps right now?

The API: yes.

The web app: not cleanly from this repo alone yet.

The current blocker is `@enact-ui/*`:

- `apps/field-app/package.json` uses `file:../../../enact-ui/...`
- root `package.json` also uses `pnpm.overrides` with sibling `enact-ui` paths
- `apps/field-app/src/index.css` uses Tailwind `@source` paths pointing at the sibling `enact-ui` checkout

That works locally, but a clean container build in Azure will fail unless the build context also includes that sibling repo.

### What container layout should we use?

Use one Azure resource group and one Azure Container Apps Environment, but deploy the runtime as separate containerized apps:

1. `v2e-web`
2. `v2e-api`
3. `v2e-ai-gateway`

That is the right shape.

Do not put all three runtimes into a single multi-container Container App unless you have a very specific reason. They have different scaling, ingress, and rollout concerns.

The shared setup should be:

- same resource group
- same Container Apps Environment
- separate Container Apps
- shared observability/networking/secrets model

## Current runtime topology

The app is really 3 pieces:

1. Web app
- React/Vite SPA from `apps/field-app`
- built static assets
- talks to the API over `VITE_API_URL`

2. API
- Node/Hono app from `apps/api`
- uses SQLite for demo mode
- depends on:
  - `AI_GATEWAY_URL`
  - `V2E_API_TOKEN`
  - `CORS_ORIGINS`
  - `SQLITE_PATH` / `DATABASE_PATH` / `DATABASE_URL`

3. AI gateway
- separate service
- API calls it for transcription/extraction
- if gateway is down, those flows fail even if web + API are up

## What must change before clean web deployment

For production-style builds, `@enact-ui/*` must stop depending on a sibling local checkout.

This does not mean local linked development has to go away.

## Enact UI: development vs production

Yes, you can publish `@enact-ui/*` and still use local links during development.

That is the preferred setup.

Target model:

- production / CI / container builds use published `@enact-ui/*` versions
- local development may still override those packages to a sibling checkout

Recommended rule:

- keep normal semver dependencies in source control
- use local overrides only for developer machines
- do not make cloud builds depend on sibling `file:` paths

Recommended implementation:

1. publish `@enact-ui/*` to a registry
2. change committed `package.json` files to use versioned package references
3. for local Enact UI development, use a local-only override workflow such as:
   - `pnpm link`
   - developer-specific `pnpm.overrides`
   - a non-committed local config/patch script

Avoid maintaining separate committed dependency graphs for dev and prod if possible. It is better to have:

- one committed production-safe dependency definition
- one local developer override mechanism

That gives you:

- reproducible CI/container builds
- still-fast local design-system iteration

Use one of these approaches:

### Option A: publish `@enact-ui/*` to a real registry

Best long-term option.

- publish versioned packages to npm, GitHub Packages, or an internal registry
- update `apps/field-app/package.json` to use semver versions
- remove root `pnpm.overrides` file-path hacks
- update Tailwind `@source` strategy so it does not depend on sibling source paths

### Option B: vendor Enact UI into this repo

Works, but heavier.

- copy the required Enact UI packages into this monorepo
- consume them as workspace packages

### Option C: include `enact-ui` as a git submodule/subtree

Better than sibling file paths, but still operationally heavier than published packages.

## Recommended Azure deployment shape

## Required prerequisites

Before containerizing the web app or mobile build in CI, publish `@enact-ui/*` properly.

This is not optional for reliable cloud builds.

Minimum required change:

1. publish `@enact-ui/*` to a registry or bring it into this repo as a real workspace/submodule dependency
2. remove sibling `file:` dependencies from:
   - [package.json](/Users/tarunrana/Documents/NAShira/Repos/voice-to-execution/package.json)
   - [apps/field-app/package.json](/Users/tarunrana/Documents/NAShira/Repos/voice-to-execution/apps/field-app/package.json)
3. remove sibling-checkout Tailwind `@source` assumptions from:
   - [apps/field-app/src/index.css](/Users/tarunrana/Documents/NAShira/Repos/voice-to-execution/apps/field-app/src/index.css)

Additional production requirements:

4. deploy both web UIs
   - V2E web UI
   - AI gateway web UI
5. move application data to Postgres for deployed environments
6. do not use SQLite as the deployed application database in Container Apps

### API

Deploy `apps/api` as an Azure Container App.

Required env vars:

- `AI_GATEWAY_URL`
- `V2E_API_TOKEN`
- `CORS_ORIGINS`
- `DATABASE_PATH` or `SQLITE_PATH`
- optionally `V2E_LOW_CONFIDENCE_THRESHOLD`

Note on SQLite:

- SQLite is acceptable for demo/pilot
- for Container Apps, the DB file should live on mounted persistent storage, not the container filesystem
- otherwise restarts/revisions can lose data

### Web

For your target setup, deploy web as its own Azure Container App too.

Recommended shape:

- build `apps/field-app`
- serve `dist/` with nginx or a tiny Node static server
- set `VITE_API_URL` at build time to the API Container App URL
- set `VITE_API_TOKEN` at build time only if the browser is expected to call authenticated pilot endpoints directly

Ingress recommendation:

- `v2e-web`: external ingress
- `v2e-api`: external ingress for browser access, unless you put a gateway/proxy in front
- `v2e-ai-gateway`: internal ingress if only the API calls it

But first, fix `@enact-ui/*` packaging.

### AI gateway

Deploy separately from web/API as its own Container App.

That can be:

- another Azure Container App
- another internal service URL
- a private service behind internal ingress if API can reach it

## Container Apps target architecture

The deployment target should look like this:

### `v2e-web`

- own Docker image
- own Container App
- externally reachable
- env/build input:
  - `VITE_API_URL`
  - `VITE_API_TOKEN` if needed

### `v2e-api`

- own Docker image
- own Container App
- reachable by browser and by `v2e-web`
- runtime env:
  - `AI_GATEWAY_URL`
  - `V2E_API_TOKEN`
  - `CORS_ORIGINS`
  - `DATABASE_PATH` / `SQLITE_PATH`
  - `V2E_LOW_CONFIDENCE_THRESHOLD`

### `v2e-ai-gateway`

- own Docker image
- own Container App
- ideally internal-only
- reachable from `v2e-api`

If the AI gateway also has its own operator/admin web UI, that UI must be deployed as a first-class surface too.

Recommended shape:

- gateway API/runtime as one Container App
- gateway web UI as a separate web container, or as a separately routed surface if the gateway already serves it correctly

Treat that as a deployment requirement, not an afterthought.

### Shared Azure resources

- one Resource Group
- one Container Apps Environment
- one Container Registry
- secrets managed per app or centrally via Key Vault references
- Postgres for application data

## Database requirement

For deployed environments, application data should live in Postgres.

That should be treated as a requirement now.

SQLite is acceptable only for:

- local development
- demo seeding
- temporary pilot-only local environments

It should not be the cloud deployment database for:

- V2E API
- shared multi-user runtime
- long-lived Container Apps environments

Production target:

- Azure Database for PostgreSQL
- API updated to use Postgres-backed persistence
- seed/demo flows adapted accordingly for non-local environments

## Minimal publish plan

If the goal is "publish now" with the least friction:

1. Publish or properly vendor `@enact-ui/*` first.
2. Move deployed persistence target to Postgres.
3. Build separate images/apps for:
   - V2E web
   - V2E API
   - AI gateway runtime
   - AI gateway web UI if separate
4. Deploy them in the same Container Apps Environment.
5. Point V2E web to API with `VITE_API_URL`.
6. Point API to gateway with `AI_GATEWAY_URL`.

## Capacitor / mobile

`apps/mobile` already exists and wraps `apps/field-app/dist`:

- `apps/mobile/package.json`
- `apps/mobile/capacitor.config.ts`

Current model:

- build `apps/field-app`
- sync the bundle into Capacitor
- native shells load the same SPA
- native plugins provide microphone, camera/gallery, status bar, splash, and
  app-settings recovery

That means mobile deployment still depends on the web app being buildable in CI
first, but native permission UX is no longer browser-only.

### Future mobile release flow

1. Set `VITE_API_URL` and `VITE_API_TOKEN` for the native build.
2. Run `pnpm --filter @v2e/mobile build`
3. Run `pnpm --filter @v2e/mobile beta:ios` or `beta:android`
4. archive/sign in Xcode and Android Studio
5. ship to TestFlight / Play internal testing

Notes:

- packaged native builds cannot rely on `localhost` or the dev `dev-token`
- Android and iOS native projects should be committed after `cap add`

### Important implication

The same `@enact-ui/*` sibling-path problem also blocks reliable mobile CI.

Until Enact UI is packaged properly, cloud web builds and native mobile builds remain environment-dependent.

## Recommendation

Yes, keep this file at the repo root.

And yes, add a dedicated Capacitor deployment note later if you want store-release steps, signing, native env vars, and device-build workflow documented in more detail.

For now, this is the main rule:

- separate Container Apps for web, API, and gateway is the correct Azure shape
- both the V2E web UI and the AI gateway web UI must be part of the deployment plan
- Postgres is the required deployed database target
- `@enact-ui/*` must be published or otherwise properly packaged before web/mobile CI deployment is reliable

---

## Azure rollout (full reference)

*Merged from former `docs/common/plans/AZURE-DEPLOYMENT-PLAN.md`, `AZURE-SHARED-SERVICES-PLAN.md`, and `COST-COMPARISON.md` (2026-03-27). This file lives under `docs/architecture/deployment/` (moved from `docs/common/`).*

### Rollout phases

| Phase | Scope |
| ----- | ----- |
| **Phase 1 (now)** | Deploy `v2e-api` + `ai-gateway` on Azure Container Apps; `v2e-web` on Azure Static Web Apps; **Azure PostgreSQL Flexible Server** for API and gateway DBs. |
| **Phase 2** | CI/CD hardening, autoscaling, dashboards, alerts; optional `ai-gateway-ui`. |
| **Phase 3 (future)** | Add **`auth-service`** as shared platform; migrate app auth from token-only to centralized JWT/JWKS where appropriate. |

### Target architecture (ASCII)

```text
Internet
   |
   +--> Azure Static Web Apps (v2e-web)
            |
            +--> Azure Container App (v2e-api, external)
                       |
                       +--> Azure Container App (ai-gateway, internal, always-on)
                       |
                       +--> (Phase 3) Azure Container App (auth-service, shared, always-on)

Backend services --> Azure PostgreSQL Flexible Server (separate DBs: v2e_app, ai_gateway, auth_platform)
Secrets            --> Azure Key Vault
Images             --> Azure Container Registry
Logs               --> Log Analytics / Azure Monitor
```

### Service definitions (summary)

| Service | Hosting | Notes |
| ------- | ------- | ----- |
| `v2e-web` | Azure Static Web Apps | Build output `apps/field-app/dist`. |
| `v2e-api` | Container Apps | Port 3000, external ingress, Postgres `v2e_app`. |
| `ai-gateway` | Container Apps | Port 4000, **internal** ingress recommended, Postgres `ai_gateway`, always-on (`minReplicas=1`). |
| `auth-service` | Container Apps (Phase 3) | Postgres `auth_platform`; internal + APIM optional. |

### Infrastructure resources (naming example)

| Resource | Suggested name |
| -------- | -------------- |
| Resource Group | `v2e-weu-d-rg` |
| Container Apps Environment | `v2e-weu-ca-env` |
| PostgreSQL Flexible Server | `v2e-weu-d-psql` |
| Container Registry | `v2eweuacr` |
| Key Vault | `v2e-weu-d-kv` |
| Static Web Apps | `v2e-web` |
| Log Analytics | `v2e-weu-d-log` |

### Shared services model

- **Phase 1:** shared core = `ai-gateway` (always-on); consumer = `v2e-api`.
- **Phase 3:** add `auth-service` (always-on); future apps consume centralized auth.
- **Database:** one PostgreSQL server, **separate databases** per service (`v2e_app`, `ai_gateway`, `auth_platform`) for isolation and restore clarity.

### Runtime environment (checklist)

**`v2e-api`:** `PORT=3000`, `DATABASE_URL` (Postgres), `AI_GATEWAY_URL` (internal FQDN of gateway), optional `AI_GATEWAY_API_KEY`, `V2E_API_TOKEN`, `API_PUBLIC_URL`, `CORS_ORIGINS`.

**`ai-gateway`:** `PORT=4000`, `DATABASE_URL` (Postgres for gateway), provider keys (`AZURE_API_KEY`, etc.), optional `CONFIG_FILE`.

**`auth-service` (Phase 3):** `DATABASE_URL`, JWT issuer/audience, key material for tokens.

### Security baseline

- Secrets in Key Vault; Managed Identity for ACR pull and KV read.
- TLS everywhere; restrict CORS to known app origins.
- Keep `ai-gateway` internal by default; service-to-service auth between API and gateway.

### Deployment order (Phase 1)

1. Provision RG, ACR, Key Vault, PostgreSQL, Container Apps environment.
2. Build/push `v2e-api` and `ai-gateway` images.
3. Deploy `ai-gateway` first (internal).
4. Deploy `v2e-api` (external, gateway + Postgres).
5. Deploy `v2e-web`.
6. Health checks and smoke tests.

### Cost planning (indicative, West Europe–style)

**Assumptions:** Container Apps consumption, PostgreSQL `B1ms` class, gateway/auth `minReplicas=1`, Static Web Apps free tier for frontend.

| Milestone | Monthly infra band (indicative) |
| --------- | ------------------------------- |
| Phase 1 (API + gateway + Postgres + ACR/KV/logs) | ~**$53–90** |
| Phase 3 (+ auth-service) | +~**$16–28** |
| **Combined** | ~**$69–115** infra baseline |

**AI token spend** is separate (Azure OpenAI / provider usage); plan a variable budget (~$10–250+ depending on traffic).

**Mobile store:** Apple Developer ~$99/yr, Google Play ~$25 one-time (outside Azure infra).

### Cost controls

- Budget alerts on Container Apps, PostgreSQL, and Azure OpenAI.
- Avoid enabling `ai-gateway-ui` unless needed.
- Right-size Postgres; scale on evidence.

### Troubleshooting (Azure CLI examples)

```bash
az containerapp logs show --name v2e-api --resource-group v2e-weu-d-rg --follow
az containerapp logs show --name ai-gateway --resource-group v2e-weu-d-rg --follow
curl -f https://<v2e-api-fqdn>/health
```

### Next actions (ops backlog)

- Production Dockerfiles for `v2e-api` and `ai-gateway`.
- Postgres migration plan from demo SQLite for deployed environments.
- CI/CD pipeline for Phase 1; auth-service contract and rollout checklist for Phase 3.
