# V2E - Code Style and Conventions

## General
- TypeScript with strict mode
- ES modules (type: "module")
- File extensions: `.ts` for source, `.js` in imports

## Import Style
- Use `.js` extension in imports for ESM compatibility
- Import order: external packages, then internal packages (@v2e/*), then relative imports

## API Patterns (Hono)
- Routes in `apps/api/src/routes/`
- Mount routers with `app.route("/path", router)`
- Error responses follow pattern: `{ error: { code, message, details? } }`
- Status codes typed as literal unions (e.g., `400 | 404 | 500`)

## Database Patterns (Drizzle)
- Schema in `packages/database/src/schema.ts`
- Use `eq()`, `and()`, `count()` from drizzle-orm
- Demo database accessed via `getDemoDb()` singleton

## Error Handling
- Custom error classes extend base Error
- Always include error code and message
- Use appropriate HTTP status codes
