import {
  appendGeneratedBatchLog,
  contentHash,
  loadGeneratedContentForModel,
  persistCurrentGeneratedContent,
  persistGeneratedModelContent,
  type GeneratedAiContentRow,
  type GeneratedTaskContentRow,
  type GeneratedUpdateContentRow,
} from "./generated-content.js";
import { deriveLocationDisplayLabel } from "./location-rules.js";
import { startOfUtcDay, startOfWeekUtc } from "./helpers.js";
import { deriveNoteState } from "./validate.js";
import type { CsvRow, MaterializedDemoBundle } from "./types.js";
import { resolveDemoDatasetPack, type DemoDomainPack } from "./domain-packs.js";

export type DemoContentGenerationOptions = {
  model: string;
  batchSize: number;
  maxBatches?: number;
  temperature: number;
  timeoutMs: number;
  promptVersion: string;
  publish: boolean;
  force: boolean;
  gatewayUrl?: string;
  apiKey?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
};

type TaskEnrichmentItem = {
  taskId: string;
  title: string;
  description: string;
};

type UpdateEnrichmentItem = {
  updateId: string;
  transcript: string;
};

type BatchIdValidationOptions<T extends { [key: string]: unknown }> = {
  kind: "task" | "update";
  idKey: keyof T & string;
  expectedIds: string[];
  items: T[];
};

class SeedGatewayClient {
  constructor(
    private readonly config: {
      baseUrl: string;
      apiKey?: string;
      timeoutMs: number;
      retries: number;
    }
  ) {}

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.apiKey
              ? { Authorization: `Bearer ${this.config.apiKey}` }
              : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            `Gateway chat request failed (${response.status}): ${text || response.statusText}`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        if ((error as Error).name === "AbortError") {
          lastError = new Error(`Gateway chat request timed out after ${this.config.timeoutMs}ms`);
        }
        if (attempt < this.config.retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
        }
      }
    }

    throw lastError ?? new Error("Gateway chat request failed");
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value: string, maxLen: number): string {
  const normalized = compactWhitespace(value);
  return normalized.length <= maxLen
    ? normalized
    : normalized.slice(0, maxLen).trimEnd();
}

function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }

  throw new Error("Model response did not contain JSON");
}

function parseItems<T extends { [key: string]: unknown }>(
  raw: string,
  kind: "task" | "update"
): T[] {
  const json = JSON.parse(extractJsonObject(raw)) as { items?: unknown };
  if (!Array.isArray(json.items)) {
    throw new Error(`Model ${kind} response missing items array`);
  }
  return json.items as T[];
}

function taskTimingWindow(task: CsvRow, anchorDate: Date): string {
  const due = new Date(task.dueDate);
  const anchor = startOfUtcDay(anchorDate);
  const currentWeekStart = startOfWeekUtc(anchor);
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
  const weekPlus2Start = new Date(currentWeekStart);
  weekPlus2Start.setUTCDate(weekPlus2Start.getUTCDate() + 14);

  if (task.status === "Done") return "completed";
  if (due < anchor) return "overdue";
  if (due.toISOString().slice(0, 10) === anchor.toISOString().slice(0, 10)) return "today";
  if (due < nextWeekStart) return "this_week";
  if (due < weekPlus2Start) return "next_week";
  return "future";
}

function domainGuidance(pack: DemoDomainPack): string {
  return [...pack.contentGuidance.taskFocus, ...pack.contentGuidance.updateFocus].join(" ");
}

function commonLanguageRules(pack: DemoDomainPack): string[] {
  const bannedTerms = pack.contentGuidance.bannedTerms.map((term) => `"${term}"`).join(", ");
  const mustUseTerms = pack.contentGuidance.mustUseTerms.map((term) => `"${term}"`).join(", ");
  return [
    "Return strict JSON only with the requested schema.",
    "Return raw JSON in the assistant content. Do not call tools and do not add markdown fences.",
    "Do not invent or change IDs, dates, statuses, locations, departments, or owners.",
    "You must return every requested item exactly once using the exact same ID values provided.",
    `Use concise, realistic field language from a ${pack.contentGuidance.domainLabel} context.`,
    "Do not use PM-system strings like ITP, QC & BC, JPC Project Management, or Daily Site Diary.",
    "Do not use placeholder wording like action #53 or generic phrasing like Trade X reports.",
    "Keep titles under 90 characters, descriptions under 180 characters, and transcripts under 220 characters.",
    `Do not use banned domain vocabulary: ${bannedTerms}.`,
    `Prefer domain-specific vocabulary such as ${mustUseTerms} when it fits the provided structured inputs.`,
  ];
}

const WORD_RE = /[A-Za-z0-9']+/g;

function words(value: string): string[] {
  return (value.match(WORD_RE) ?? []).map((word) => word.toLowerCase());
}

function validateTaskWording(item: TaskEnrichmentItem): string[] {
  const titleWords = words(item.title);
  const descriptionWords = words(item.description);
  const titleSet = new Set(titleWords);
  const descriptionSet = new Set(descriptionWords);
  const overlap = [...titleSet].filter((word) => descriptionSet.has(word));
  const errors: string[] = [];

  if (titleWords.length < 3 || titleWords.length > 5) {
    errors.push(`title must be 3-5 words (got ${titleWords.length})`);
  }
  if (descriptionWords.length < 10 || descriptionWords.length > 20) {
    errors.push(`description must be 10-20 words (got ${descriptionWords.length})`);
  }
  if (overlap.length > 3) {
    errors.push(
      `description repeats too much from title (shared words: ${overlap.join(", ")})`
    );
  }
  return errors;
}

function validateExactBatchIds<T extends { [key: string]: unknown }>({
  kind,
  idKey,
  expectedIds,
  items,
}: BatchIdValidationOptions<T>): void {
  const actualIds = items.map((item) => String(item[idKey] ?? "").trim());
  const missingIdIndexes = actualIds
    .map((id, index) => ({ id, index }))
    .filter((entry) => !entry.id)
    .map((entry) => entry.index);

  if (missingIdIndexes.length > 0) {
    throw new Error(
      `${kind} batch response missing ${idKey} at item indexes: ${missingIdIndexes.join(", ")}`
    );
  }

  const duplicates = [...new Set(actualIds.filter((id, index) => actualIds.indexOf(id) !== index))];
  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds);
  const missing = expectedIds.filter((id) => !actualSet.has(id));
  const extras = actualIds.filter((id) => !expectedSet.has(id));

  if (
    actualIds.length !== expectedIds.length ||
    duplicates.length > 0 ||
    missing.length > 0 ||
    extras.length > 0
  ) {
    const details = [
      `expected ${expectedIds.length} ids, got ${actualIds.length}`,
      duplicates.length > 0 ? `duplicate ids: ${duplicates.slice(0, 5).join(", ")}` : "",
      missing.length > 0 ? `missing ids: ${missing.slice(0, 5).join(", ")}` : "",
      extras.length > 0 ? `unexpected ids: ${extras.slice(0, 5).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    throw new Error(`${kind} batch returned the wrong ids: ${details}`);
  }
}

async function callGatewayStructured(
  client: SeedGatewayClient,
  options: DemoContentGenerationOptions,
  kind: "task" | "update",
  system: string,
  user: string
): Promise<string> {
  const response = await client.post<ChatCompletionResponse>("/v1/chat/completions", {
    model: options.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: options.temperature,
    max_tokens: 2400,
  });

  const message = response.choices?.[0]?.message;
  const content = message?.content?.trim();
  if (content) return content;
  const toolArgs = message?.tool_calls?.[0]?.function?.arguments?.trim();
  if (toolArgs) return toolArgs;
  throw new Error(`Empty ${kind} content-generation response from gateway`);
}

async function requestStructuredItems<T extends { [key: string]: unknown }>(
  client: SeedGatewayClient,
  options: DemoContentGenerationOptions,
  kind: "task" | "update",
  system: string,
  user: string
): Promise<T[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const attemptUser =
        attempt === 0
          ? user
          : `${user}\n\nImportant: your previous reply was not valid JSON. Return raw JSON only. Do not use tools. Do not add prose or markdown fences.`;
      const raw = await callGatewayStructured(
        client,
        options,
        kind,
        system,
        attemptUser
      );
      return parseItems<T>(raw, kind);
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error(`Failed to parse ${kind} enrichment batch`);
}

function resolveLocationLabel(
  row: CsvRow,
  locationsById: Map<string, CsvRow>
): string {
  if (row.location?.trim()) return row.location.trim();
  const location = locationsById.get((row.locationId ?? "").trim());
  return location ? deriveLocationDisplayLabel(location) : "";
}

type TaskPayload = {
  taskId: string;
  department: string;
  severity: string;
  status: string;
  timingWindow: string;
  location: string;
  ownerRole: string;
  categoryHint: string;
  blockerSubtype: string;
};

type UpdatePayload = {
  updateId: string;
  updateStatus: string;
  noteState: string;
  category: string;
  blockerSubtype: string;
  department: string;
  severity: string;
  location: string;
  reviewPrompt: string;
  reporterRole: string;
  relatedTaskTitle: string;
  relatedTaskStatus: string;
  relatedTaskTimingWindow: string;
};

function toTaskGeneratedRow(
  item: TaskEnrichmentItem,
  inputHash: string,
  options: DemoContentGenerationOptions,
  generatedAt: string
): GeneratedTaskContentRow {
  return {
    id: item.taskId,
    title: clampText(item.title, 90),
    description: clampText(item.description, 180),
    inputHash,
    model: options.model,
    promptVersion: options.promptVersion,
    generatedAt,
  };
}

function toUpdateGeneratedRow(
  item: UpdateEnrichmentItem,
  inputHash: string,
  options: DemoContentGenerationOptions,
  generatedAt: string
): GeneratedUpdateContentRow {
  return {
    id: item.updateId,
    transcript: clampText(item.transcript, 220),
    inputHash,
    model: options.model,
    promptVersion: options.promptVersion,
    generatedAt,
  };
}

function buildAiGeneratedRows(
  bundle: MaterializedDemoBundle,
  model: string,
  promptVersion: string
): GeneratedAiContentRow[] {
  const tasksById = new Map(bundle.rows.tasks.map((task) => [task.id, task] as const));
  const rows: GeneratedAiContentRow[] = [];
  const generatedAt = new Date().toISOString();

  for (const ai of bundle.rows.updateAi) {
    const spawnedTask = bundle.rows.tasks.find((task) => task.sourceUpdateId === ai.updateId);
    const linkedUpdate = bundle.rows.updates.find((update) => update.id === ai.updateId);
    const linkedTask =
      linkedUpdate?.linkedTaskId?.trim()
        ? tasksById.get(linkedUpdate.linkedTaskId.trim())
        : undefined;
    const sourceTask = spawnedTask ?? linkedTask;
    const generatedTaskDescription = clampText(
      sourceTask?.description?.trim() || ai.generatedTaskDescription,
      180
    );
    rows.push({
      updateId: ai.updateId,
      generatedTaskDescription,
      inputHash: contentHash({
        updateId: ai.updateId,
        sourceTaskId: sourceTask?.id ?? "",
        generatedTaskDescription,
      }),
      model,
      promptVersion,
      generatedAt,
    });
    ai.generatedTaskDescription = generatedTaskDescription;
  }

  return rows;
}

function sortTaskRows(rows: Iterable<GeneratedTaskContentRow>): GeneratedTaskContentRow[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function sortUpdateRows(rows: Iterable<GeneratedUpdateContentRow>): GeneratedUpdateContentRow[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function sortAiRows(rows: Iterable<GeneratedAiContentRow>): GeneratedAiContentRow[] {
  return [...rows].sort((a, b) => a.updateId.localeCompare(b.updateId));
}

async function generateTasksForModel(
  bundle: MaterializedDemoBundle,
  anchorDate: Date,
  options: DemoContentGenerationOptions,
  client: SeedGatewayClient,
  existingRows: Map<string, GeneratedTaskContentRow>,
  persist: (tasks: Map<string, GeneratedTaskContentRow>) => Promise<void>
) {
  const pack = resolveDemoDatasetPack(bundle.datasetKey);
  const project = bundle.rows.projects[0];
  const locationsById = new Map(bundle.rows.locations.map((row) => [row.id, row] as const));
  const updateAiByUpdateId = new Map(
    bundle.rows.updateAi.map((row) => [row.updateId, row] as const)
  );

  const system = [
    `You generate realistic demo task titles and descriptions for a ${pack.contentGuidance.domainLabel} app.`,
    domainGuidance(pack),
    ...commonLanguageRules(pack),
    "The task title must be an action-oriented work item of exactly 3 to 5 words.",
    "The task description must be one concise sentence of 10 to 20 words.",
    "Do not repeat too much of the title inside the description. Up to 3 shared words is acceptable when needed for realistic phrasing.",
    "Do not put the full location string in the title.",
    'Respond with JSON: {"items":[{"taskId":"...","title":"...","description":"..."}]}.',
  ].join("\n");

  const batches = chunk(bundle.rows.tasks, options.batchSize);
  const limitedBatches =
    options.maxBatches && options.maxBatches > 0
      ? batches.slice(0, options.maxBatches)
      : batches;

  const processBatch = async (batch: CsvRow[], label: string): Promise<void> => {
    console.log(`  Task wording batch ${label} (${batch.length} tasks)`);
    const payload = batch.map((task) => {
      const ai = task.sourceUpdateId ? updateAiByUpdateId.get(task.sourceUpdateId) : undefined;
      return {
        taskId: task.id,
        department: task.department || ai?.department || "",
        severity: task.severity,
        status: task.status,
        timingWindow: taskTimingWindow(task, anchorDate),
        location: resolveLocationLabel(task, locationsById),
        ownerRole: task.assigneeRole,
        categoryHint: ai?.category ?? "",
        blockerSubtype: ai?.blockerSubtype ?? "",
      } satisfies TaskPayload;
    });

    const pending = payload.filter((item) => {
      if (options.force) return true;
      const existing = existingRows.get(item.taskId);
      const inputHash = contentHash(item);
      return !existing ||
        existing.inputHash !== inputHash ||
        existing.promptVersion !== options.promptVersion;
    });

    if (pending.length === 0) {
      await appendGeneratedBatchLog(bundle.dir, options.model, {
        entityType: "tasks",
        model: options.model,
        promptVersion: options.promptVersion,
        batchLabel: label,
        status: "skipped",
        itemIds: payload.map((item) => item.taskId),
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    const user = [
      `Project: ${project?.code ?? bundle.datasetKey}`,
      `Project name: ${project?.name ?? bundle.datasetKey}`,
      `Site type: ${pack.siteType}`,
      `Bundle variant: ${pack.bundleVariant}`,
      "Rewrite the following task wording only. Keep all structure and meaning aligned to the supplied fields.",
      "Return exactly one output item per input item using the same taskId values.",
      JSON.stringify({ items: pending }, null, 2),
    ].join("\n\n");

    try {
      const items = await requestStructuredItems<TaskEnrichmentItem>(
        client,
        options,
        "task",
        system,
        user
      );
      validateExactBatchIds({
        kind: "task",
        idKey: "taskId",
        expectedIds: pending.map((item) => item.taskId),
        items,
      });
      const invalid = items
        .map((item) => ({
          taskId: item.taskId,
          errors: validateTaskWording(item),
        }))
        .filter((entry) => entry.errors.length > 0);
      if (invalid.length > 0) {
        throw new Error(
          `Task wording validation failed: ${invalid
            .slice(0, 3)
            .map((entry) => `${entry.taskId}: ${entry.errors.join("; ")}`)
            .join(" | ")}`
        );
      }
      const generatedAt = new Date().toISOString();
      for (const item of items) {
        const source = pending.find((row) => row.taskId === item.taskId);
        if (!source) continue;
        const generated = toTaskGeneratedRow(
          item,
          contentHash(source),
          options,
          generatedAt
        );
        existingRows.set(generated.id, generated);
        const task = bundle.rows.tasks.find((row) => row.id === generated.id);
        if (task) {
          task.title = generated.title;
          task.description = generated.description;
        }
      }
      await persist(existingRows);
      await appendGeneratedBatchLog(bundle.dir, options.model, {
        entityType: "tasks",
        model: options.model,
        promptVersion: options.promptVersion,
        batchLabel: label,
        status: "generated",
        itemIds: pending.map((item) => item.taskId),
        generatedAt,
      });
    } catch (error) {
      if (batch.length <= 1) {
        await appendGeneratedBatchLog(bundle.dir, options.model, {
          entityType: "tasks",
          model: options.model,
          promptVersion: options.promptVersion,
          batchLabel: label,
          status: "failed",
          itemIds: pending.map((item) => item.taskId),
          generatedAt: new Date().toISOString(),
          details: (error as Error).message,
        });
        throw error;
      }
      const midpoint = Math.ceil(batch.length / 2);
      console.log(`    Retrying task batch ${label} as two smaller batches`);
      await processBatch(batch.slice(0, midpoint), `${label}.1`);
      await processBatch(batch.slice(midpoint), `${label}.2`);
    }
  };

  for (const [index, batch] of limitedBatches.entries()) {
    await processBatch(batch, `${index + 1}/${limitedBatches.length}`);
  }
}

async function generateUpdatesForModel(
  bundle: MaterializedDemoBundle,
  anchorDate: Date,
  options: DemoContentGenerationOptions,
  client: SeedGatewayClient,
  existingRows: Map<string, GeneratedUpdateContentRow>,
  persist: (updates: Map<string, GeneratedUpdateContentRow>) => Promise<void>
) {
  const pack = resolveDemoDatasetPack(bundle.datasetKey);
  const project = bundle.rows.projects[0];
  const locationsById = new Map(bundle.rows.locations.map((row) => [row.id, row] as const));
  const tasksById = new Map(bundle.rows.tasks.map((row) => [row.id, row] as const));
  const updateAiByUpdateId = new Map(
    bundle.rows.updateAi.map((row) => [row.updateId, row] as const)
  );
  const usersById = new Map(bundle.rows.users.map((row) => [row.id, row] as const));

  const system = [
    `You generate realistic voice-note transcripts for a ${pack.contentGuidance.domainLabel} demo app.`,
    domainGuidance(pack),
    ...commonLanguageRules(pack),
    "The transcript should sound like a short operational field update that could have been spoken by a supervisor, lead, or operator.",
    "Do not mention that this is AI-generated.",
    'Respond with JSON: {"items":[{"updateId":"...","transcript":"..."}]}.',
  ].join("\n");

  const batches = chunk(bundle.rows.updates, options.batchSize);
  const limitedBatches =
    options.maxBatches && options.maxBatches > 0
      ? batches.slice(0, options.maxBatches)
      : batches;

  const processBatch = async (batch: CsvRow[], label: string): Promise<void> => {
    console.log(`  Update wording batch ${label} (${batch.length} updates)`);
    const payload = batch.map((update) => {
      const ai = updateAiByUpdateId.get(update.id);
      const linkedTask = update.linkedTaskId ? tasksById.get(update.linkedTaskId) : undefined;
      const spawnedTask = bundle.rows.tasks.find((task) => task.sourceUpdateId === update.id);
      const task = linkedTask ?? spawnedTask;
      const noteState = deriveNoteState(
        update.status,
        update.createdAt,
        linkedTask ? { createdAt: linkedTask.createdAt } : undefined
      );
      const reporter = usersById.get(update.recordedBy);

      return {
        updateId: update.id,
        updateStatus: update.status,
        noteState,
        category: ai?.category ?? "",
        blockerSubtype: ai?.blockerSubtype ?? "",
        department: ai?.department ?? task?.department ?? "",
        severity: ai?.severity ?? task?.severity ?? "",
        location: resolveLocationLabel(
          ai ? { ...ai, locationId: ai.locationId, location: ai.location } : update,
          locationsById
        ),
        reviewPrompt: ai?.reviewPrompt ?? "",
        reporterRole: reporter?.orgRole ?? reporter?.role ?? "",
        relatedTaskTitle: task?.title ?? "",
        relatedTaskStatus: task?.status ?? "",
        relatedTaskTimingWindow: task ? taskTimingWindow(task, anchorDate) : "",
      } satisfies UpdatePayload;
    });

    const pending = payload.filter((item) => {
      if (options.force) return true;
      const existing = existingRows.get(item.updateId);
      const inputHash = contentHash(item);
      return !existing ||
        existing.inputHash !== inputHash ||
        existing.promptVersion !== options.promptVersion;
    });

    if (pending.length === 0) {
      await appendGeneratedBatchLog(bundle.dir, options.model, {
        entityType: "updates",
        model: options.model,
        promptVersion: options.promptVersion,
        batchLabel: label,
        status: "skipped",
        itemIds: payload.map((item) => item.updateId),
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    const user = [
      `Project: ${project?.code ?? bundle.datasetKey}`,
      `Project name: ${project?.name ?? bundle.datasetKey}`,
      `Site type: ${pack.siteType}`,
      `Bundle variant: ${pack.bundleVariant}`,
      "Rewrite the following update transcripts only. Ground each update in its related task context when provided.",
      "Return exactly one output item per input item using the same updateId values.",
      JSON.stringify({ items: pending }, null, 2),
    ].join("\n\n");

    try {
      const items = await requestStructuredItems<UpdateEnrichmentItem>(
        client,
        options,
        "update",
        system,
        user
      );
      validateExactBatchIds({
        kind: "update",
        idKey: "updateId",
        expectedIds: pending.map((item) => item.updateId),
        items,
      });
      const generatedAt = new Date().toISOString();
      for (const item of items) {
        const source = pending.find((row) => row.updateId === item.updateId);
        if (!source) continue;
        const generated = toUpdateGeneratedRow(
          item,
          contentHash(source),
          options,
          generatedAt
        );
        existingRows.set(generated.id, generated);
        const update = bundle.rows.updates.find((row) => row.id === generated.id);
        if (update) {
          update.transcript = generated.transcript;
        }
      }
      await persist(existingRows);
      await appendGeneratedBatchLog(bundle.dir, options.model, {
        entityType: "updates",
        model: options.model,
        promptVersion: options.promptVersion,
        batchLabel: label,
        status: "generated",
        itemIds: pending.map((item) => item.updateId),
        generatedAt,
      });
    } catch (error) {
      if (batch.length <= 1) {
        await appendGeneratedBatchLog(bundle.dir, options.model, {
          entityType: "updates",
          model: options.model,
          promptVersion: options.promptVersion,
          batchLabel: label,
          status: "failed",
          itemIds: pending.map((item) => item.updateId),
          generatedAt: new Date().toISOString(),
          details: (error as Error).message,
        });
        throw error;
      }
      const midpoint = Math.ceil(batch.length / 2);
      console.log(`    Retrying update batch ${label} as two smaller batches`);
      await processBatch(batch.slice(0, midpoint), `${label}.1`);
      await processBatch(batch.slice(midpoint), `${label}.2`);
    }
  };

  for (const [index, batch] of limitedBatches.entries()) {
    await processBatch(batch, `${index + 1}/${limitedBatches.length}`);
  }
}

export async function generateBundleContentForModel(
  bundle: MaterializedDemoBundle,
  anchorDate: Date,
  options: DemoContentGenerationOptions
): Promise<void> {
  const client = new SeedGatewayClient({
    baseUrl: options.gatewayUrl || process.env.AI_GATEWAY_URL || "http://localhost:4000",
    apiKey: options.apiKey,
    timeoutMs: options.timeoutMs,
    retries: 2,
  });

  const existing = await loadGeneratedContentForModel(bundle.dir, options.model);
  const taskRows = new Map(existing.tasks.map((row) => [row.id, row] as const));
  const updateRows = new Map(existing.updates.map((row) => [row.id, row] as const));

  const persistAll = async () => {
    const aiRows = buildAiGeneratedRows(bundle, options.model, options.promptVersion);
    await persistGeneratedModelContent(bundle.dir, options.model, {
      tasks: sortTaskRows(taskRows.values()),
      updates: sortUpdateRows(updateRows.values()),
      updateAi: sortAiRows(aiRows),
    });
    if (options.publish) {
      await persistCurrentGeneratedContent(bundle.dir, {
        tasks: sortTaskRows(taskRows.values()),
        updates: sortUpdateRows(updateRows.values()),
        updateAi: sortAiRows(aiRows),
      });
    }
  };

  await generateTasksForModel(bundle, anchorDate, options, client, taskRows, persistAll);
  await generateUpdatesForModel(bundle, anchorDate, options, client, updateRows, persistAll);
  await persistAll();
}
