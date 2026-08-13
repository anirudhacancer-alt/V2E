import { z } from "zod";

/**
 * Persisted AI extraction row linked to `updates` (`update_ai_outputs` table).
 */
export const ReviewStatusEnum = z.enum([
  "pending",
  "accepted",
  "rejected",
  "needs_human_review",
  "superseded",
]);

export const ExtractionSchema = z.object({
  id: z.string().uuid(),
  updateId: z.string().uuid(),
  category: z.string(),
  departmentCode: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  locationId: z.string(),
  blockerSubtype: z.string().nullable().optional(),
  locationBlock: z.string().nullable().optional(),
  locationZone: z.string().nullable().optional(),
  locationLevel: z.string().nullable().optional(),
  locationArea: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  severity: z.string(),
  ownerRoleCode: z.string(),
  ownerId: z.string().nullable().optional(),
  dueDate: z.string(),
  generatedTaskDescription: z.string(),
  riskImpact: z.string(),
  scheduleRisk: z.string(),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean(),
  reviewPrompt: z.string().nullable().optional(),
  reviewReasonsJson: z.string(),
  reviewFieldsJson: z.string(),
  humanReviewRequired: z.boolean(),
  reviewStatus: ReviewStatusEnum,
  reviewedAt: z.string().nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
  suggestedSnapshotJson: z.string().nullable().optional(),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export const CreateExtractionSchema = z.object({
  updateId: z.string().uuid(),
  category: z.string(),
  departmentCode: z.string().optional(),
  location: z.string().optional(),
  locationId: z.string(),
  blockerSubtype: z.string().optional(),
  locationBlock: z.string().optional(),
  locationZone: z.string().optional(),
  locationLevel: z.string().optional(),
  locationArea: z.string().optional(),
  vendor: z.string().optional(),
  severity: z.string(),
  ownerRoleCode: z.string(),
  ownerId: z.string().optional(),
  dueDate: z.string(),
  generatedTaskDescription: z.string(),
  riskImpact: z.string(),
  scheduleRisk: z.string(),
  confidence: z.number().min(0).max(1),
  reviewRequired: z.boolean().default(false),
  reviewPrompt: z.string().optional(),
  reviewReasonsJson: z.string().default("[]"),
  reviewFieldsJson: z.string().default("[]"),
  humanReviewRequired: z.boolean().default(false),
  suggestedSnapshotJson: z.string().optional(),
});

export type CreateExtraction = z.infer<typeof CreateExtractionSchema>;

export const PatchExtractionSchema = z.object({
  reviewStatus: ReviewStatusEnum.optional(),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),
  humanReviewRequired: z.boolean().optional(),
  reviewRequired: z.boolean().optional(),
});

export type PatchExtraction = z.infer<typeof PatchExtractionSchema>;
