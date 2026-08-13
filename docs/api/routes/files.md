# `/v1/files`

**Source:** `apps/api/src/routes/files.ts` — `v1.route("/files", filesRouter)`.

Canonical file metadata for uploads; complements legacy `GET /uploads/*` static serving on the root app ([root.md](root.md)).

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `POST` | `/v1/files` | Bearer | Upload file (`multipart/form-data`). |
| `GET` | `/v1/files/:fileId` | No | File metadata. |
| `GET` | `/v1/files/:fileId/content` | No | Binary content (`Content-Type`, `Content-Disposition`). |
| `DELETE` | `/v1/files/:fileId` | Bearer | Delete record and on-disk file. |

**Data model:** [file.md](../../data-model/file.md).

**Audit:** `file.created`, `file.deleted` (see [audit.md](audit.md)).

Parent: [AGENTS.md](AGENTS.md).
