# Voice-to-Execution (V2E) Project Overview

## Purpose
V2E is a construction site management application that converts voice updates into structured tasks via AI. It's a mobile-first web app designed for site supervisors.

## Tech Stack
- **Runtime**: Node.js (API), Vite (Web)
- **Frontend**: React 19, TanStack Router (file-based), TanStack Query, Tailwind v4
- **Backend**: Hono framework on Node.js + @hono/node-server
- **Database**: SQLite via Drizzle ORM
- **Validation**: Zod (contracts package)
- **Build**: Turbo (monorepo), pnpm workspaces
- **AI**: Custom ai-gateway service for transcription and extraction

## Monorepo Structure
- **apps/api** - Hono on Node.js (port 3000)
- **apps/field-app** - React 19 + Vite + TanStack Router (port 3001)
- **packages/contracts** - Zod schemas shared across apps
- **packages/database** - Drizzle ORM + SQLite
- **packages/ai** - AI gateway client for transcription/extraction
- **packages/shared** - Shared utilities

## Key Patterns
- Contracts-first: Define Zod schemas before implementing features
- API endpoints follow RESTful conventions
- Demo data in SQLite for development

## Database
SQLite file at `packages/database/data/demo.sqlite`. Schema in `packages/database/src/schema.ts`.
