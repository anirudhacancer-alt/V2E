/**
 * AI Gateway Types
 */

// ============================================================================
// Configuration
// ============================================================================

export interface GatewayConfig {
  /** Base URL of the ai-gateway service (e.g., http://localhost:4000) */
  baseUrl: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 3) */
  retries?: number;
}

// ============================================================================
// Model Selection
// ============================================================================

/** V2E model aliases that map to providers.yaml model IDs */
export type V2EModelAlias =
  | "transcription" // Default STT model
  | "transcription-fast" // Faster but less accurate STT
  | "extraction" // Default extraction model
  | "extraction-fast" // Faster extraction
  | "completion"; // General completion

/** Model ID as registered by ai-gateway (see getModels() / STT model keys in config.yml). */
export type ModelId = string;

/**
 * Maps V2E aliases to gateway model keys (must match ai-gateway `config.yml`, not legacy qualified names).
 * Qualified IDs like `azure_foundry:text:gpt-4-1-mini` are not registered in the gateway and break chat completions.
 */
export const MODEL_MAPPING: Record<V2EModelAlias, ModelId> = {
  transcription: "whisper",
  /** Azure Speech STT is not fully implemented in gateway; use whisper for reliability. */
  "transcription-fast": "whisper",
  extraction: "gpt-4-1-mini",
  "extraction-fast": "gpt-5-nano",
  completion: "gpt-4-1-mini",
};

// ============================================================================
// Transcription
// ============================================================================

export interface TranscriptionRequest {
  /** Audio file as base64 encoded string */
  audioBase64?: string;
  /** URL to audio file */
  audioUrl?: string;
  /** MIME type of audio (default: audio/webm) */
  mimeType?: string;
  /** Language code (default: en) */
  language?: string;
  /** Model to use (defaults to transcription alias) */
  model?: V2EModelAlias | ModelId;
}

export interface TranscriptionResponse {
  /** Transcribed text */
  text: string;
  /** Detected or specified language */
  language: string;
  /** Audio duration in seconds */
  duration?: number;
  /** Transcription confidence (0-1) */
  confidence?: number;
  /** Model ID that was used */
  modelUsed: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// ============================================================================
// Extraction
// ============================================================================

export interface ExtractedInfo {
  category:
    | "Blocker"
    | "WorkCompletion"
    | "QAIssue"
    | "MaterialDelay"
    | "GeneralUpdate";
  department?: string;
  location?: string;
  vendor?: string;
  severity: "Critical" | "High" | "Medium" | "Low";
}

export interface SuggestedAssignment {
  ownerRole: string;
  ownerId?: string;
  dueDate: string;
}

export interface RiskAssessment {
  impact: string;
  downstreamEffects: string[];
  scheduleRisk: "None" | "Low" | "Medium" | "High" | "Critical";
  recommendedActions: string[];
}

export interface ReviewRequirement {
  required: boolean;
  reasons: Array<
    | "low_confidence_extraction"
    | "new_task_proposed"
    | "category_uncertain"
    | "location_uncertain"
    | "severity_uncertain"
    | "owner_uncertain"
    | "due_date_uncertain"
  >;
  fields: Array<
    | "extraction"
    | "category"
    | "location"
    | "severity"
    | "owner"
    | "dueDate"
    | "taskProposal"
  >;
  prompt?: string;
}

export interface AIProcessedOutput {
  extractedInfo: ExtractedInfo;
  suggestedAssignment: SuggestedAssignment;
  generatedTaskDescription: string;
  riskAssessment: RiskAssessment;
  confidence: number;
  reviewRequirement: ReviewRequirement;
}

export interface ExtractionRequest {
  /** The update ID being processed */
  updateId: string;
  /** The transcript text to extract information from */
  transcript: string;
  /** Optional project context to improve extraction */
  projectContext?: {
    projectId: string;
    projectName: string;
    departments: string[];
    locations: string[];
  };
  /** Model to use (defaults to extraction alias) */
  model?: V2EModelAlias | ModelId;
}

export interface ExtractionResponse {
  /** The update ID that was processed */
  updateId: string;
  /** The extracted AI output */
  aiOutput: AIProcessedOutput;
  /** Model ID that was used */
  modelUsed: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Version number for this extraction */
  version: number;
}

// ============================================================================
// Completion
// ============================================================================

export interface CompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  messages: CompletionMessage[];
  model?: V2EModelAlias | ModelId;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResponse {
  content: string;
  modelUsed: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingTimeMs: number;
}

// ============================================================================
// Errors
// ============================================================================

export class GatewayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export class TranscriptionError extends GatewayError {
  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message, code, statusCode, details);
    this.name = "TranscriptionError";
  }
}

export class ExtractionError extends GatewayError {
  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message, code, statusCode, details);
    this.name = "ExtractionError";
  }
}
