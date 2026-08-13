#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, "..", "..")
const ROUTES_DIR = join(REPO_ROOT, "apps", "api", "src", "routes")
const INVENTORY_PATH = join(REPO_ROOT, "ROUTE-INVENTORY.md")

const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete"])
const MUTATION_METHODS = new Set(["post", "put", "patch"])
const EXCLUDED_ROUTE_FILES = /\.(?:test)\.ts$/

const routerNameToFile = new Map()
const fileInfoCache = new Map()

function walk(dir) {
  const out = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, ent.name)
    if (ent.isDirectory()) {
      out.push(...walk(next))
      continue
    }
    if (!ent.isFile()) continue
    if (!ent.name.endsWith(".ts")) continue
    if (EXCLUDED_ROUTE_FILES.test(ent.name)) continue
    out.push(next)
  }
  return out
}

function normalizeRoutePath(path) {
  return path.replace(/:[^/]+/g, ":*")
}

function joinPaths(prefix, child) {
  if (child === "/") return prefix
  if (prefix.endsWith("/")) return `${prefix.slice(0, -1)}${child}`
  return `${prefix}${child}`
}

function resolveImportPath(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null
  const withTs = resolve(dirname(fromFile), specifier.replace(/\.js$/u, ".ts"))
  if (existsSync(withTs) && statSync(withTs).isFile()) {
    return withTs
  }
  const withIndex = resolve(
    dirname(fromFile),
    specifier.replace(/\.js$/u, ""),
    "index.ts",
  )
  if (existsSync(withIndex) && statSync(withIndex).isFile()) {
    return withIndex
  }
  return null
}

function getText(node, sourceFile) {
  return node.getText(sourceFile)
}

function findRouterDeclarations(sourceFile) {
  const routers = new Set()
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
      if (!ts.isNewExpression(decl.initializer)) continue
      if (getText(decl.initializer.expression, sourceFile) !== "Hono") continue
      routers.add(decl.name.text)
    }
  })
  return routers
}

function findLocalFunctions(sourceFile) {
  const functions = new Map()

  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.set(node.name.text, node)
      return
    }

    if (!ts.isVariableStatement(node)) return
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
      if (
        ts.isArrowFunction(decl.initializer) ||
        ts.isFunctionExpression(decl.initializer)
      ) {
        functions.set(decl.name.text, decl.initializer)
      }
    }
  })

  return functions
}

function getImportedBindings(filePath, sourceFile) {
  const imports = new Map()

  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node)) return
    const moduleSpecifier = node.moduleSpecifier
    if (!ts.isStringLiteral(moduleSpecifier)) return
    const targetFile = resolveImportPath(filePath, moduleSpecifier.text)
    if (!targetFile || !node.importClause) return

    const clause = node.importClause
    if (clause.name) {
      imports.set(clause.name.text, targetFile)
    }
    if (!clause.namedBindings) return
    if (ts.isNamespaceImport(clause.namedBindings)) {
      imports.set(clause.namedBindings.name.text, targetFile)
      return
    }
    for (const el of clause.namedBindings.elements) {
      imports.set(el.name.text, targetFile)
    }
  })

  return imports
}

function isStringPathArg(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

function getHandlerNode(args) {
  if (args.length < 2) return null
  return args[args.length - 1]
}

function loadFileInfo(filePath) {
  if (fileInfoCache.has(filePath)) {
    return fileInfoCache.get(filePath)
  }

  const text = readFileSync(filePath, "utf8")
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  const routers = findRouterDeclarations(sourceFile)
  const localFunctions = findLocalFunctions(sourceFile)
  const imports = getImportedBindings(filePath, sourceFile)
  const routes = []
  const mounts = []

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression
      if (ts.isIdentifier(owner) && routers.has(owner.text)) {
        const method = node.expression.name.text
        if (ROUTE_METHODS.has(method)) {
          const [pathArg] = node.arguments
          if (pathArg && isStringPathArg(pathArg)) {
            routes.push({
              routerName: owner.text,
              method,
              path: pathArg.text,
              handlerNode: getHandlerNode(node.arguments),
              callNode: node,
              filePath,
            })
          }
        } else if (method === "route") {
          const [pathArg, childArg] = node.arguments
          if (
            pathArg &&
            childArg &&
            isStringPathArg(pathArg) &&
            ts.isIdentifier(childArg)
          ) {
            mounts.push({
              routerName: owner.text,
              path: pathArg.text,
              childRouter: childArg.text,
              filePath,
            })
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  const info = {
    filePath,
    sourceFile,
    text,
    routers,
    routes,
    mounts,
    imports,
    localFunctions,
  }

  for (const routerName of routers) {
    if (!routerNameToFile.has(routerName)) {
      routerNameToFile.set(routerName, filePath)
    }
  }

  fileInfoCache.set(filePath, info)
  return info
}

function collectSignalsFromText(text) {
  const query =
    /\.req\.query\(/u.test(text) ||
    /\.req\.queries\(/u.test(text) ||
    /zValidator\(\s*["']query["']/u.test(text) ||
    /\bparseRequiredProjectIdQuery\s*\(/u.test(text) ||
    /\bparseProjectIdFromQuery\s*\(/u.test(text) ||
    /\bprojectIdQueryError\s*\(/u.test(text)

  const body =
    /\.req\.json\(/u.test(text) ||
    /\.req\.parseBody\(/u.test(text) ||
    /\.req\.formData\(/u.test(text) ||
    /zValidator\(\s*["']json["']/u.test(text) ||
    /zValidator\(\s*["']form["']/u.test(text) ||
    /\bparseProjectIdFromUnknown\s*\(/u.test(text) ||
    /\bprojectIdBodyError\s*\(/u.test(text) ||
    /formData\.get\(\s*["']projectId["']\s*\)/u.test(text) ||
    /\bbody\.projectId\b/u.test(text) ||
    /\braw\.projectId\b/u.test(text) ||
    /\bscopeBody\.projectId\b/u.test(text) ||
    /\bparseResult\.data\.projectId\b/u.test(text)

  return { query, body }
}

function getSingleForwardedCall(node) {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (!ts.isBlock(node.body)) {
      return ts.isCallExpression(node.body) ? node.body : null
    }
    if (node.body.statements.length !== 1) return null
    const [stmt] = node.body.statements
    if (ts.isReturnStatement(stmt) && stmt.expression && ts.isCallExpression(stmt.expression)) {
      return stmt.expression
    }
    if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
      return stmt.expression
    }
    return null
  }
  return null
}

function resolveFunctionReference(filePath, name) {
  const info = loadFileInfo(filePath)
  const local = info.localFunctions.get(name)
  if (local) {
    return { filePath, node: local }
  }
  const importedPath = info.imports.get(name)
  if (!importedPath) return null
  const importedInfo = loadFileInfo(importedPath)
  const importedNode = importedInfo.localFunctions.get(name)
  if (!importedNode) return null
  return { filePath: importedPath, node: importedNode }
}

function analyzeHandlerNode(filePath, handlerNode, seen = new Set()) {
  if (!handlerNode) {
    return { query: false, body: false }
  }

  if (ts.isIdentifier(handlerNode)) {
    const key = `${filePath}:${handlerNode.text}`
    if (seen.has(key)) return { query: false, body: false }
    seen.add(key)
    const resolved = resolveFunctionReference(filePath, handlerNode.text)
    if (!resolved) return { query: false, body: false }
    return analyzeHandlerNode(resolved.filePath, resolved.node, seen)
  }

  if (
    ts.isCallExpression(handlerNode) &&
    ts.isIdentifier(handlerNode.expression)
  ) {
    return analyzeHandlerNode(filePath, handlerNode.expression, seen)
  }

  const singleForward = getSingleForwardedCall(handlerNode)
  if (
    singleForward &&
    ts.isIdentifier(singleForward.expression)
  ) {
    return analyzeHandlerNode(filePath, singleForward.expression, seen)
  }

  const info = loadFileInfo(filePath)
  const text = getText(handlerNode, info.sourceFile)
  return collectSignalsFromText(text)
}

function collectRoutesFrom(routerName, prefix, visited = new Set()) {
  const key = `${routerName}@${prefix}`
  if (visited.has(key)) return []
  visited.add(key)

  const filePath = routerNameToFile.get(routerName)
  if (!filePath) return []

  const info = loadFileInfo(filePath)
  const out = []

  for (const route of info.routes.filter((r) => r.routerName === routerName)) {
    const fullPath = joinPaths(prefix, route.path)
    const signals = analyzeHandlerNode(filePath, route.handlerNode)
    out.push({
      ...route,
      fullPath,
      normalizedPath: normalizeRoutePath(fullPath),
      signals,
    })
  }

  for (const mount of info.mounts.filter((m) => m.routerName === routerName)) {
    const childPrefix = joinPaths(prefix, mount.path)
    out.push(...collectRoutesFrom(mount.childRouter, childPrefix, visited))
  }

  return out
}

function generateInventoryMarkdown(routes) {
  const sorted = [...routes].sort((a, b) => {
    if (a.fullPath !== b.fullPath) return a.fullPath.localeCompare(b.fullPath);
    return a.method.localeCompare(b.method);
  });

  const lines = [
    `# Route Inventory\n`,
    `> **Automated Inventory**: This file is auto-generated by \`scripts/check/route-structure-invariant.mjs\`. Do not edit manually.\n`,
    `**Architectural Invariants (ADR-0011):**`,
    `1. **Standard REST Collections**: Single-item CRUD (\`GET/PATCH/DELETE\`) uses the unique ID in the **path** (e.g., \`/v1/tasks/:taskId\`).`,
    `2. **Resource Scoping**: Read operations (\`GET\`) use **query parameters** for filtering and scoping (\`?projectId=...\`).`,
    `3. **Mutation Payloads**: Write operations (\`POST/PUT/PATCH\`) use the **JSON body** for payload data. Local platform invariant: query parameters are not used for mutation inputs.`,
    `4. **Nested resource actions**: Update- or task-scoped commands use nested paths (e.g., \`POST /v1/updates/:updateId/transcribe\`) with \`projectId\` and other inputs in the JSON body when needed.`,
    `5. **AI job endpoints**: On-demand AI work that is not CRUD on a stable resource uses \`POST /v1/ai/<job-name>\` (e.g., voice-note extraction, standup summary).\n`,
    `---\n`,
    `| Method | Path | Input Location | File |`,
    `|--------|------|----------------|------|`,
  ];

  for (const r of sorted) {
    const methodStr = r.method.toUpperCase();
    let loc = "N/A";
    
    // Resource identity from path
    if (r.fullPath.includes(":")) {
      loc = "Path";
    }
    
    // Scoping/Filtering from Query
    if (r.signals.query) {
      loc = loc === "Path" ? "Path + Query" : "Query";
    }
    
    // Payload from Body
    if (r.signals.body) {
      loc = loc === "Path" ? "Path + Body" : "Body";
    }
    
    const fileRel = relative(REPO_ROOT, r.filePath);
    lines.push(`| **${methodStr}** | \`${r.fullPath}\` | ${loc} | \`${fileRel}\` |`);
  }

  lines.push(`\n*Updated: ${new Date().toISOString().split('T')[0]}*\n`);
  writeFileSync(INVENTORY_PATH, lines.join("\n"), "utf8");
}

function isAllowedProjectEntityPath(route) {
  return route.fullPath === "/v1/projects/:projectId"
}

function buildSourceViolations(routes) {
  const violations = []

  for (const route of routes) {
    const relPath = relative(REPO_ROOT, route.filePath)

    if (route.fullPath.includes(":projectId") && !isAllowedProjectEntityPath(route)) {
      violations.push({
        type: "path-param",
        route,
        relPath,
        message:
          "projectId must not appear in route paths outside the canonical project entity route `/v1/projects/:projectId`.",
      })
    }

    if (route.method === "get" && route.signals.body) {
      violations.push({
        type: "get-body",
        route,
        relPath,
        message:
          "GET handler appears to source parameters from request body/form-data instead of query parameters.",
      })
    }

    if (MUTATION_METHODS.has(route.method) && route.signals.query) {
      violations.push({
        type: "mutation-query",
        route,
        relPath,
        message:
          "Mutation handler (POST/PUT/PATCH/DELETE) uses query parameters. All parameters must be in the request body.",
      })
    }
  }

  return violations
}



function printSourceViolations(violations) {
  if (violations.length === 0) return
  console.error("route-structure-invariant: source violations found\n")
  for (const violation of violations) {
    console.error(
      `  [${violation.route.method.toUpperCase()}] ${violation.route.fullPath}\n` +
        `    ${violation.message}\n` +
        `    at ${violation.relPath}\n`,
    )
  }
}

function main() {
  const routeFiles = walk(ROUTES_DIR)
  for (const filePath of routeFiles) {
    loadFileInfo(filePath)
  }

  const routes = collectRoutesFrom("v1", "/v1")
  const sourceViolations = buildSourceViolations(routes)

  printSourceViolations(sourceViolations)

  if (sourceViolations.length > 0) {
    // Inventory is only valid and updated when there are no violations.
    process.exit(1)
  }

  generateInventoryMarkdown(routes)

  console.log(
    `route-structure-invariant: OK (${routes.length} routes checked, auto-generated ROUTE-INVENTORY.md).`,
  )
}

main()
