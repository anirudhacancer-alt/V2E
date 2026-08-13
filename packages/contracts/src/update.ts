import { z } from "zod";
import { DepartmentEnum, SeverityEnum, UpdateCategoryEnum } from "./enums.js";
import { MediaAssetSchema } from "./media.js";

export const ReviewReasonEnum = z.enum([
  "low_confidence_extraction",
  "new_task_proposed",
  "category_uncertain",
  "location_uncertain",
  "severity_uncertain",
  "owner_uncertain",
  "due_date_uncertain",
]);

export type ReviewReason = z.infer<typeof ReviewReasonEnum>;

export const ReviewFieldEnum = z.enum([
  "extraction",
  "category",
  "location",
  "severity",
  "owner",
  "dueDate",
  "taskProposal",
]);

export type ReviewField = z.infer<typeof ReviewFieldEnum>;

export const ReviewRequirementSchema = z.object({
  required: z.boolean(),
  reasons: z.array(ReviewReasonEnum).default([]),
  fields: z.array(ReviewFieldEnum).default([]),
  prompt: z.string().optional(),
});

export type ReviewRequirement = z.infer<typeof ReviewRequirementSchema>;

const REVIEW_REASON_ORDER: ReviewReason[] = [
  "low_confidence_extraction",
  "new_task_proposed",
  "category_uncertain",
  "location_uncertain",
  "severity_uncertain",
  "owner_uncertain",
  "due_date_uncertain",
];

const REVIEW_FIELD_ORDER: ReviewField[] = [
  "extraction",
  "taskProposal",
  "category",
  "location",
  "severity",
  "owner",
  "dueDate",
];

const REVIEW_FIELD_LABELS: Record<ReviewField, string> = {
  extraction: "AI extraction",
  taskProposal: "new task proposal",
  category: "category",
  location: "location",
  severity: "severity",
  owner: "owner",
  dueDate: "due date",
};

function orderedUnique<T extends string>(
  values: Iterable<T>,
  order: readonly T[]
): T[] {
  const set = new Set(values);
  return order.filter((value) => set.has(value));
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function buildReviewPrompt(requirement: {
  reasons: ReviewReason[];
  fields: ReviewField[];
}): string {
  const fieldLabels = orderedUnique(
    requirement.fields.filter(
      (field): field is Exclude<ReviewField, "extraction" | "taskProposal"> =>
        field !== "extraction" && field !== "taskProposal"
    ),
    REVIEW_FIELD_ORDER.filter(
      (field): field is Exclude<ReviewField, "extraction" | "taskProposal"> =>
        field !== "extraction" && field !== "taskProposal"
    )
  ).map((field) => REVIEW_FIELD_LABELS[field]);

  const hasLowConfidence = requirement.reasons.includes("low_confidence_extraction");
  const hasTaskProposal = requirement.reasons.includes("new_task_proposed");

  if (hasLowConfidence && hasTaskProposal) {
    if (fieldLabels.length > 0) {
      return `Confirm: AI extraction, new task proposal, and ${joinLabels(fieldLabels)}`;
    }
    return "Confirm: AI extraction and new task proposal";
  }

  if (hasTaskProposal) {
    if (fieldLabels.length > 0) {
      return `Confirm: new task proposal and ${joinLabels(fieldLabels)}`;
    }
    return "Confirm: new task proposal";
  }

  if (fieldLabels.length > 0) {
    return `Confirm: ${joinLabels(fieldLabels)}`;
  }

  if (hasLowConfidence) {
    return "Confirm: AI extraction";
  }

  return "Confirm: AI extraction";
}

export function normalizeReviewRequirement(input: {
  requirement?: Partial<ReviewRequirement> | null;
  confidence: number;
  lowConfidenceThreshold?: number;
  taskProposalSuggested?: boolean;
}): ReviewRequirement {
  const threshold = input.lowConfidenceThreshold ?? 0.65;
  const rawReasons = new Set<ReviewReason>(input.requirement?.reasons ?? []);
  const rawFields = new Set<ReviewField>(input.requirement?.fields ?? []);

  if (input.confidence < threshold) {
    rawReasons.add("low_confidence_extraction");
    rawFields.add("extraction");
  }

  if (input.taskProposalSuggested) {
    rawReasons.add("new_task_proposed");
    rawFields.add("taskProposal");
  }

  const reasons = orderedUnique(rawReasons, REVIEW_REASON_ORDER);
  const fields = orderedUnique(rawFields, REVIEW_FIELD_ORDER);
  const required =
    input.requirement?.required !== undefined
      ? input.requirement.required
      : reasons.length > 0;

  let prompt = input.requirement?.prompt?.trim();
  if (!prompt && required) {
    prompt = buildReviewPrompt({ reasons, fields });
  } else if (prompt && !prompt.toLowerCase().startsWith("confirm:")) {
    prompt = `Confirm: ${prompt}`;
  }

  return {
    required,
    reasons,
    fields,
    prompt,
  };
}

export const ExtractedInformationSchema = z.object({
  category: UpdateCategoryEnum,
  department: DepartmentEnum.optional(),
  location: z.string().min(1).max(200).optional(),
  /** Demo seed FK to locations master row (`locations.csv`). */
  locationId: z.string().min(1).max(80).optional(),
  vendor: z.string().min(1).max(200).optional(),
  severity: SeverityEnum,
});

export type ExtractedInformation = z.infer<typeof ExtractedInformationSchema>;

export const SuggestedAssignmentSchema = z.object({
  ownerRole: z.string().min(1),
  ownerId: z.string().uuid().optional(),
  dueDate: z.date(),
});

export type SuggestedAssignment = z.infer<typeof SuggestedAssignmentSchema>;

export const RiskAssessmentSchema = z.object({
  impact: z.string().min(1),
  downstreamEffects: z.array(z.string()),
  scheduleRisk: z.enum(["None", "Low", "Medium", "High", "Critical"]),
  recommendedActions: z.array(z.string()),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

export const AIProcessedOutputSchema = z.object({
  extractedInfo: ExtractedInformationSchema,
  suggestedAssignment: SuggestedAssignmentSchema,
  generatedTaskDescription: z.string().min(1),
  riskAssessment: RiskAssessmentSchema,
  confidence: z.number().min(0).max(1),
  reviewRequirement: ReviewRequirementSchema,
});

export type AIProcessedOutput = z.infer<typeof AIProcessedOutputSchema>;

export const UpdateSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  projectId: z.string().uuid(),
  /** Demo seed FK to locations master row. */
  locationId: z.string().min(1).max(80).optional(),
  recordedBy: z.string().uuid(),
  transcript: z.string().min(1),
  audioUrl: z.string().url().optional(),
  audioDuration: z.number().int().min(1).optional(),
  attachments: z.array(MediaAssetSchema).default([]),
  aiOutput: AIProcessedOutputSchema.optional(),
  status: z.enum(["Pending", "Processed", "CreatedNewTask", "Escalated", "Saved"]),
  /** Note references an existing task (human follow-up); see `tasks.sourceUpdateId` for the voice→task edge */
  linkedTaskId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Update = z.infer<typeof UpdateSchema>;

export const CreateUpdateSchema = z.object({
  siteId: z.string().uuid(),
  projectId: z.string().uuid(),
  recordedBy: z.string().uuid(),
  transcript: z.string().min(1),
  audioUrl: z.string().url().optional(),
  audioDuration: z.number().int().min(1).optional(),
  attachments: z.array(MediaAssetSchema).optional().default([]),
  /** Optional when recording a follow-up on an existing task */
  linkedTaskId: z.string().uuid().optional(),
});

export type CreateUpdate = z.infer<typeof CreateUpdateSchema>;

export const UpdateRecentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  location: z.string(),
  timestamp: z.date(),
  category: UpdateCategoryEnum,
});

export type UpdateRecent = z.infer<typeof UpdateRecentSchema>;
