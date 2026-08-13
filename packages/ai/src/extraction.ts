/**
 * Extraction Service
 *
 * Handles AI extraction of structured data from transcripts via ai-gateway.
 */

import { GatewayClient, gatewayClient } from "./client.js";
import {
  type ExtractionRequest,
  type ExtractionResponse,
  type AIProcessedOutput,
  type CompletionMessage,
  type ExtractedInfo,
  type RiskAssessment,
  type ReviewRequirement,
  ExtractionError,
} from "./types.js";

const REVIEW_REASON_ORDER: ReviewRequirement["reasons"] = [
  "low_confidence_extraction",
  "new_task_proposed",
  "category_uncertain",
  "location_uncertain",
  "severity_uncertain",
  "owner_uncertain",
  "due_date_uncertain",
];

const REVIEW_FIELD_ORDER: ReviewRequirement["fields"] = [
  "extraction",
  "taskProposal",
  "category",
  "location",
  "severity",
  "owner",
  "dueDate",
];

const REVIEW_FIELD_LABELS: Record<ReviewRequirement["fields"][number], string> = {
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
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function buildReviewPrompt(requirement: {
  reasons: ReviewRequirement["reasons"];
  fields: ReviewRequirement["fields"];
}): string {
  const fieldLabels = orderedUnique(
    requirement.fields.filter(
      (
        field
      ): field is Exclude<ReviewRequirement["fields"][number], "extraction" | "taskProposal"> =>
        field !== "extraction" && field !== "taskProposal"
    ),
    REVIEW_FIELD_ORDER.filter(
      (
        field
      ): field is Exclude<ReviewRequirement["fields"][number], "extraction" | "taskProposal"> =>
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
  return "Confirm: AI extraction";
}

function normalizeReviewRequirement(input: {
  requirement?: Partial<ReviewRequirement> | null;
  confidence: number;
  lowConfidenceThreshold?: number;
  taskProposalSuggested?: boolean;
}): ReviewRequirement {
  const threshold = input.lowConfidenceThreshold ?? 0.65;
  const rawReasons = new Set<ReviewRequirement["reasons"][number]>(
    input.requirement?.reasons ?? []
  );
  const rawFields = new Set<ReviewRequirement["fields"][number]>(
    input.requirement?.fields ?? []
  );

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

const EXTRACTION_SYSTEM_PROMPT = `You are an AI assistant helping construction site supervisors process voice updates.
Your task is to extract structured information from transcribed voice updates.

Analyze the transcript and extract:
1. Category: One of Blocker, WorkCompletion, QAIssue, MaterialDelay, GeneralUpdate
2. Department: The work package / discipline involved (if mentioned)
3. Location: Where on the site (if mentioned)
4. Severity: Critical, High, Medium, or Low based on impact
5. Suggested assignment: Who should handle this (role)
6. Due date: When this should be addressed
7. Task description: A clear, actionable task description
8. Risk assessment: Impact, downstream effects, and recommended actions
9. Review requirement: be explicit about what the supervisor must confirm

Set reviewRequirement.required to true when:
- confidence is low
- a new task is being proposed
- critical extracted fields are uncertain

Set reviewRequirement.prompt to a short explicit instruction starting with "Confirm:".

Respond with a single JSON object only (no markdown fences, no commentary). Use camelCase keys: extractedInfo, suggestedAssignment, generatedTaskDescription, riskAssessment, confidence, reviewRequirement.`;

const CATEGORY_VALUES: ExtractedInfo["category"][] = [
  "Blocker",
  "WorkCompletion",
  "QAIssue",
  "MaterialDelay",
  "GeneralUpdate",
];

const SEVERITY_VALUES: ExtractedInfo["severity"][] = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

const SCHEDULE_RISK_VALUES: RiskAssessment["scheduleRisk"][] = [
  "None",
  "Low",
  "Medium",
  "High",
  "Critical",
];

/** Model output may include markdown fences or prose; extract a JSON object substring. */
function stripAssistantJsonPayload(content: string): string {
  let s = content.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return s.slice(start, end + 1);
  }
  return s;
}

function asNonEmptyString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function coerceCategory(v: unknown): ExtractedInfo["category"] {
  const s = typeof v === "string" ? v.trim() : "";
  return CATEGORY_VALUES.includes(s as ExtractedInfo["category"])
    ? (s as ExtractedInfo["category"])
    : "GeneralUpdate";
}

function coerceSeverity(v: unknown): ExtractedInfo["severity"] {
  const s = typeof v === "string" ? v.trim() : "";
  return SEVERITY_VALUES.includes(s as ExtractedInfo["severity"])
    ? (s as ExtractedInfo["severity"])
    : "Medium";
}

function coerceScheduleRisk(v: unknown): RiskAssessment["scheduleRisk"] {
  const s = typeof v === "string" ? v.trim() : "";
  return SCHEDULE_RISK_VALUES.includes(s as RiskAssessment["scheduleRisk"])
    ? (s as RiskAssessment["scheduleRisk"])
    : "None";
}

/**
 * Map heterogeneous / snake_case model output into {@link AIProcessedOutput}.
 * The ai-gateway chat route does not forward `response_format`, so models often return free-form JSON.
 */
function coerceExtractionOutput(raw: unknown, transcript: string): AIProcessedOutput {
  if (!raw || typeof raw !== "object") {
    throw new ExtractionError(
      "Invalid extraction output structure",
      "VALIDATION_ERROR",
      undefined,
      { detail: "root_not_object" }
    );
  }

  const o = raw as Record<string, unknown>;
  const eiIn = (o.extractedInfo ?? o.extracted_info) as Record<string, unknown> | undefined;
  const saIn = (o.suggestedAssignment ?? o.suggested_assignment) as Record<string, unknown> | undefined;
  const riskIn = (o.riskAssessment ?? o.risk_assessment) as Record<string, unknown> | undefined;
  const rrIn = (o.reviewRequirement ?? o.review_requirement) as Record<string, unknown> | undefined;

  const extractedInfo: ExtractedInfo = {
    category: coerceCategory(eiIn?.category),
    department:
      typeof eiIn?.department === "string" ? eiIn.department.trim() || undefined : undefined,
    location:
      typeof eiIn?.location === "string" ? eiIn.location.trim() || undefined : undefined,
    vendor: typeof eiIn?.vendor === "string" ? eiIn.vendor.trim() || undefined : undefined,
    severity: coerceSeverity(eiIn?.severity),
  };

  const today = new Date().toISOString().slice(0, 10);
  const suggestedAssignment = {
    ownerRole: asNonEmptyString(saIn?.ownerRole ?? saIn?.owner_role, "Site Supervisor"),
    ownerId:
      typeof saIn?.ownerId === "string" && saIn.ownerId.trim()
        ? saIn.ownerId.trim()
        : typeof saIn?.owner_id === "string" && saIn.owner_id.trim()
          ? saIn.owner_id.trim()
          : undefined,
    dueDate: asNonEmptyString(saIn?.dueDate ?? saIn?.due_date, today),
  };

  const generatedTaskDescription = asNonEmptyString(
    o.generatedTaskDescription ?? o.generated_task_description,
    transcript.slice(0, 500),
  );

  const riskAssessment: RiskAssessment = {
    impact: asNonEmptyString(riskIn?.impact, "See transcript for details."),
    downstreamEffects: asStringArray(riskIn?.downstreamEffects ?? riskIn?.downstream_effects),
    scheduleRisk: coerceScheduleRisk(riskIn?.scheduleRisk ?? riskIn?.schedule_risk),
    recommendedActions: asStringArray(
      riskIn?.recommendedActions ?? riskIn?.recommended_actions,
    ),
  };

  const confidence =
    typeof o.confidence === "number" && Number.isFinite(o.confidence)
      ? Math.min(1, Math.max(0, o.confidence))
      : 0.55;

  const reviewRequirement: ReviewRequirement = {
    required: typeof rrIn?.required === "boolean" ? rrIn.required : true,
    reasons: Array.isArray(rrIn?.reasons)
      ? (rrIn.reasons as unknown[]).filter(
          (r): r is ReviewRequirement["reasons"][number] =>
            typeof r === "string" &&
            [
              "low_confidence_extraction",
              "new_task_proposed",
              "category_uncertain",
              "location_uncertain",
              "severity_uncertain",
              "owner_uncertain",
              "due_date_uncertain",
            ].includes(r),
        )
      : [],
    fields: Array.isArray(rrIn?.fields)
      ? (rrIn.fields as unknown[]).filter(
          (f): f is ReviewRequirement["fields"][number] =>
            typeof f === "string" &&
            [
              "extraction",
              "category",
              "location",
              "severity",
              "owner",
              "dueDate",
              "taskProposal",
            ].includes(f),
        )
      : [],
    prompt:
      typeof rrIn?.prompt === "string" && rrIn.prompt.trim() ? rrIn.prompt.trim() : undefined,
  };

  return {
    extractedInfo,
    suggestedAssignment,
    generatedTaskDescription,
    riskAssessment,
    confidence,
    reviewRequirement,
  };
}

/**
 * Extraction Service
 *
 * Extracts structured information from voice update transcripts.
 */
export class ExtractionService {
  private client: GatewayClient;

  constructor(client?: GatewayClient) {
    this.client = client || gatewayClient;
  }

  /**
   * Extract structured information from a transcript
   *
   * @param request - Extraction request with transcript
   * @returns Extraction response with AI output
   */
  async extract(request: ExtractionRequest): Promise<ExtractionResponse> {
    if (!request.transcript || request.transcript.trim().length === 0) {
      throw new ExtractionError(
        "Transcript is required",
        "INVALID_REQUEST"
      );
    }

    const startTime = Date.now();
    const modelId = this.client.resolveModel(request.model || "extraction");

    // Build context-aware prompt
    let userPrompt = `Transcript to analyze:\n\n"${request.transcript}"`;

    if (request.projectContext) {
      userPrompt += `\n\nProject context:
- Project: ${request.projectContext.projectName}
- Known departments: ${request.projectContext.departments.join(", ")}
- Known locations: ${request.projectContext.locations.join(", ")}`;
    }

    const messages: CompletionMessage[] = [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    try {
      // Make completion request with JSON schema
      const response = await this.client.post<{
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      }>("/v1/chat/completions", {
        model: modelId,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ExtractionError(
          "Empty response from model",
          "EXTRACTION_ERROR"
        );
      }

      const jsonText = stripAssistantJsonPayload(content);
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new ExtractionError(
          "Failed to parse extraction response",
          "PARSE_ERROR",
          undefined,
          { contentPreview: content.slice(0, 800) }
        );
      }

      const coerced = coerceExtractionOutput(parsed, request.transcript);
      const aiOutput: AIProcessedOutput = {
        ...coerced,
        reviewRequirement: normalizeReviewRequirement({
          requirement: coerced.reviewRequirement,
          confidence: coerced.confidence,
          taskProposalSuggested: Boolean(coerced.generatedTaskDescription?.trim()),
        }),
      };

      return {
        updateId: request.updateId,
        aiOutput,
        modelUsed: modelId,
        processingTimeMs: Date.now() - startTime,
        version: 1,
      };
    } catch (error) {
      if (error instanceof ExtractionError) {
        throw error;
      }
      throw new ExtractionError(
        (error as Error).message || "Extraction failed",
        "EXTRACTION_ERROR"
      );
    }
  }

  /**
   * Re-extract with updated context (creates new version)
   *
   * @param request - Extraction request
   * @param currentVersion - Current version number
   * @returns Extraction response with incremented version
   */
  async reextract(
    request: ExtractionRequest,
    currentVersion: number
  ): Promise<ExtractionResponse> {
    const result = await this.extract(request);
    return {
      ...result,
      version: currentVersion + 1,
    };
  }
}

// Export singleton instance
export const extractionService = new ExtractionService();
