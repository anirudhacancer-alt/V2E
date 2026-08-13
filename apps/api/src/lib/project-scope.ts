import type { Context } from "hono";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuidProjectId(raw: string | undefined): string | null {
  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Parse `projectId` from the `projectId` query parameter (GET requests).
 */
export function parseProjectIdFromQuery(c: Context): string | null {
  return parseUuidProjectId(c.req.query("projectId"));
}

/**
 * Same as {@link parseProjectIdFromQuery}; use for handlers that require a valid UUID.
 */
export function parseRequiredProjectIdQuery(c: Context): string | null {
  return parseProjectIdFromQuery(c);
}

export function projectIdQueryError(c: Context) {
  return c.json(
    {
      error: {
        code: "MISSING_PROJECT_ID",
        message:
          "Query parameter projectId (UUID) is required for project-scoped GET requests",
      },
    },
    400
  );
}

/**
 * Parse `projectId` from a JSON object (request body).
 */
export function parseProjectIdFromUnknown(body: unknown): string | null {
  if (!body || typeof body !== "object" || body === null) {
    return null;
  }
  const raw = (body as Record<string, unknown>).projectId;
  return parseUuidProjectId(typeof raw === "string" ? raw : undefined);
}

export function projectIdBodyError(c: Context) {
  return c.json(
    {
      error: {
        code: "MISSING_PROJECT_ID",
        message:
          "JSON body must include projectId (UUID) for project-scoped operations",
      },
    },
    400
  );
}

export function projectScopeMismatchError(
  c: Context,
  details: { updateId: string; expectedProjectId: string }
) {
  return c.json(
    {
      error: {
        code: "PROJECT_SCOPE_MISMATCH",
        message: "Update does not belong to the specified project",
        details,
      },
    },
    403
  );
}
