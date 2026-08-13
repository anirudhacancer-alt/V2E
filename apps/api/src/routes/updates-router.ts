/**
 * Entry `/v1/updates` router: multipart create only.
 *
 * Read/list/detail/update commands are mounted separately via `update-actions.ts`.
 */

import { Hono } from "hono";

import { handleCreateUpdate } from "./uploads.js";
import { requireAuth } from "../middleware/auth.js";

const updatesEntryRouter = new Hono();
updatesEntryRouter.post("/", requireAuth, handleCreateUpdate);

export { updatesEntryRouter };
