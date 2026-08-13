# Git hook scripts

Git **hook entrypoints** live in **`.husky/`** only (thin wrappers). All **implementation** for this repo’s hooks lives here under **`scripts/git/`**.

## Layout

| `.husky/` file | Calls |
| -------------- | ----- |
| `pre-commit` | `scripts/git/pre-commit.sh` |
| `pre-push` | `scripts/git/pre-push.sh` |
| `post-merge` | `scripts/git/post-merge.sh` |
| `post-commit` | `scripts/git/post-commit.sh` |
| `post-checkout` | `scripts/git/post-checkout.sh` |

## Scripts in this directory

| Script | Role |
| ------ | ---- |
| `pre-commit.sh` | LFS/staged checks (`pre-commit-staged-lfs.sh`), `check-docs-agent-entry-files.sh`, `pnpm check:agents-md-contract`, docs tree check, Markdown frontmatter (scoped paths), contracts boundary, route-structure invariant, Turbo typecheck |
| `pre-commit-staged-lfs.sh` | CSV LFS pointer validation + 10 MB staged file cap |
| `check-docs-agent-entry-files.sh` | Rejects `README.md` under `docs/` except `docs/architecture/adr/README.md`, and rejects `INDEX.md` under `docs/`; stderr points at `docs/AGENTS.md#what-belongs-in-agentsmd` |
| `scripts/check/agents-md-contract-doc.mjs` | (`pnpm check:agents-md-contract`) Ensures `docs/AGENTS.md` keeps the **What belongs** / **What usually does not belong** contract headings |
| `scripts/check/route-structure-invariant.mjs` | (`pnpm check:route-structure-invariant`) Enforces ADR 0011 source invariants for project-scoped API routes and prints route-inventory drift warnings |
| `pre-push.sh` | `git lfs pre-push`, Vitest, Playwright E2E (WebKit) |
| `post-merge.sh` / `post-commit.sh` / `post-checkout.sh` | Passthrough to `git lfs` for the matching hook |

Do not add business logic under `.husky/` except the one-line `bash scripts/git/…` dispatch; edit the scripts here instead.

## Manual runs

From the repository root (same as hooks):

```bash
bash scripts/git/pre-commit.sh
bash scripts/git/pre-push.sh
```

Post hooks are normally only run by Git; invoke `git lfs post-*` directly if debugging.
