import { z } from "zod";

/** Demo seed location master row (per-contract `locations.csv` under docs/demo/datasets). */
export const LocationSchema = z.object({
  id: z.string().min(1).max(80),
  /** Project code (e.g. RES-1328); seed resolves to DB `projectId`. */
  projectCode: z.string().min(1).max(50),
  siteType: z.enum(["Residential", "Commercial", "Factory"]),
  level1: z.string().min(1).max(120),
  level2: z.string().max(120).optional(),
  level3: z.string().max(120).optional(),
  level4: z.string().max(120).optional(),
  /** Optional in CSV; must match `level1`–`level4` join if present. */
  displayLabel: z.string().max(400).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0),
});

export type Location = z.infer<typeof LocationSchema>;

/** Create schema - omits system-generated id field. */
export const CreateLocationSchema = LocationSchema.omit({ id: true });
export type CreateLocation = z.infer<typeof CreateLocationSchema>;

/** Update schema - all fields optional for partial updates. */
export const UpdateLocationSchema = CreateLocationSchema.partial();
export type UpdateLocation = z.infer<typeof UpdateLocationSchema>;
