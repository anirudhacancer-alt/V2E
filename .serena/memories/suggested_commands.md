# V2E - Development Commands

## Basic Development
```bash
pnpm install           # Install all dependencies
pnpm dev               # Start all apps in dev mode (API :3000, Web :3001)
pnpm build             # Build all packages and apps
pnpm typecheck         # Type-check all packages
pnpm test              # Unit tests (Vitest)
pnpm clean             # Remove dist, node_modules, .turbo caches
```

## Individual Packages
```bash
pnpm --filter @v2e/field-app dev          # Web app only
pnpm --filter @v2e/api dev          # API only
pnpm --filter @v2e/contracts build  # Build contracts package
pnpm --filter @v2e/ai build         # Build AI package
```

## Database Commands
```bash
pnpm --filter @v2e/database db:generate   # Generate Drizzle migrations
pnpm --filter @v2e/database db:push       # Push schema to SQLite
pnpm --filter @v2e/database db:seed       # Seed demo data
```

## Testing/Quality
```bash
pnpm typecheck                            # Full typecheck
pnpm --filter @v2e/api typecheck          # API typecheck only
pnpm test                                 # Run tests
```
