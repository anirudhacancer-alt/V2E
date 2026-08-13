/**
 * AI-generated standup summary via ai-gateway chat completions.
 */

import { gatewayClient } from "./client.js";
import type { GatewayClient } from "./client.js";
import type { V2EModelAlias } from "./types.js";

export interface StandupSummaryInput {
  projectName: string;
  standupDate: string;
  attendancePresent: number;
  attendanceTotal: number;
  completedItems: Array<{ description: string; location?: string | null }>;
  blockedItems: Array<{ description: string; severity: string; blockerReason: string }>;
  plannedItems: Array<{
    description: string;
    location?: string | null;
    department?: string | null;
  }>;
}

export class StandupSummaryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "StandupSummaryError";
  }
}

const SYSTEM = `You are an assistant for construction site supervisors preparing a daily standup brief.
The work spans realistic site operations (concrete, steel, masonry, carpentry, plumbing, MEP, and general departments).

Write ONLY in this Markdown shape (no title line, no preamble):

## Progress

First paragraph: 2–4 sentences on what moved forward (departments, locations, completions).

Second paragraph: 2–4 sentences with additional progress detail or scope notes.

## Blockers / Risks

First paragraph: 2–4 sentences on blocked work, severity, and causes.

Second paragraph: 2–4 sentences on residual risks, dependencies, or what to watch.

## Next Steps

First paragraph: 2–4 sentences on planned focus and sequencing for today.

Second paragraph: 2–4 sentences on follow-ups, coordination, or housekeeping.

Each section MUST have exactly two short paragraphs separated by one blank line. Use the ## headings exactly as shown.
Ground every statement in the input; do not invent tasks, locations, or people.`;

export class StandupSummaryService {
  private client: GatewayClient;

  constructor(client?: GatewayClient) {
    this.client = client || gatewayClient;
  }

  async summarize(
    input: StandupSummaryInput,
    model?: V2EModelAlias | string
  ): Promise<{ summaryText: string; modelUsed: string; processingTimeMs: number }> {
    const start = Date.now();
    const modelId = this.client.resolveModel(model || "completion");

    const completedLines = input.completedItems
      .map(
        (c) =>
          `- ${c.description}${c.location ? ` @ ${c.location}` : ""}`
      )
      .join("\n");
    const blockedLines = input.blockedItems
      .map((b) => `- [${b.severity}] ${b.description}: ${b.blockerReason}`)
      .join("\n");
    const plannedLines = input.plannedItems
      .map((p) => {
        const label = p.department;
        return `- ${p.description}${label ? ` (${label})` : ""}${p.location ? ` @ ${p.location}` : ""}`;
      })
      .join("\n");

    const user = `Project: ${input.projectName}
Standup date: ${input.standupDate}
Attendance: ${input.attendancePresent} present of ${input.attendanceTotal} expected

Completed work:
${completedLines || "(none listed)"}

Blocked / at-risk:
${blockedLines || "(none listed)"}

Planned / focus:
${plannedLines || "(none listed)"}

Produce the standup summary now using the Markdown structure from your instructions (three ## sections, two paragraphs each).`;

    try {
      const response = await this.client.post<{
        choices: Array<{ message: { content: string } }>;
      }>("/v1/chat/completions", {
        model: modelId,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        temperature: 0.35,
        max_tokens: 900,
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new StandupSummaryError("Empty model response", "EMPTY_RESPONSE");
      }

      return {
        summaryText: text,
        modelUsed: modelId,
        processingTimeMs: Date.now() - start,
      };
    } catch (e) {
      if (e instanceof StandupSummaryError) {
        throw e;
      }
      throw new StandupSummaryError(
        (e as Error).message || "Standup summary failed",
        "SUMMARY_FAILED"
      );
    }
  }
}

export const standupSummaryService = new StandupSummaryService();
