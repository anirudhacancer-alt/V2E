import { z } from "zod";

export const SiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  address: z.string().min(1),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  projectManagerId: z.string().uuid(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Site = z.infer<typeof SiteSchema>;

export const CreateSiteSchema = SiteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateSite = z.infer<typeof CreateSiteSchema>;

export const UpdateSiteSchema = CreateSiteSchema.partial();

export type UpdateSite = z.infer<typeof UpdateSiteSchema>;

export const SiteSummarySchema = z.object({
  siteId: z.string().uuid(),
  siteName: z.string(),
  plannedVsDone: z.number().min(0).max(100),
  openBlockers: z.number().int().min(0),
  qaIssues: z.number().int().min(0),
  materialDelays: z.number().int().min(0),
});

export type SiteSummary = z.infer<typeof SiteSummarySchema>;
