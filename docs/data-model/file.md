# Entity: File

**Table:** `files`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`files`)

## Purpose

Canonical metadata for uploaded blobs. Attachment rows may still store a `url` while migration to `fileId` FKs is optional.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `storageKey` | text | notNull | Key in upload store |
| `fileName` | text | notNull | |
| `mimeType` | text | notNull | |
| `sizeBytes` | integer | notNull | |
| `checksum` | text | optional | |
| `uploadedByUserId` | text | optional | FK when known |
| `createdAt` | text | notNull | |

## Contracts

- [`packages/contracts/src/file.ts`](../../packages/contracts/src/file.ts)

## API

- [files.md](../api/routes/files.md)

## See also

- [index.md](./index.md)
