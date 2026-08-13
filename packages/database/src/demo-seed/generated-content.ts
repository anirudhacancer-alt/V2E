import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "../parse-csv.js";
import { serializeCsv } from "../serialize-csv.js";
import type { CsvRow, DemoBundleRows } from "./types.js";

export type GeneratedTaskContentRow = {
  id: string;
  title: string;
  description: string;
  inputHash: string;
  model: string;
  promptVersion: string;
  generatedAt: string;
};

export type GeneratedUpdateContentRow = {
  id: string;
  transcript: string;
  inputHash: string;
  model: string;
  promptVersion: string;
  generatedAt: string;
};

export type GeneratedAiContentRow = {
  updateId: string;
  generatedTaskDescription: string;
  inputHash: string;
  model: string;
  promptVersion: string;
  generatedAt: string;
};

export type GeneratedContentBatchLog = {
  entityType: "tasks" | "updates";
  model: string;
  promptVersion: string;
  batchLabel: string;
  status: "generated" | "skipped" | "failed";
  itemIds: string[];
  generatedAt: string;
  details?: string;
};

const TASK_HEADERS = [
  "id",
  "title",
  "description",
  "inputHash",
  "model",
  "promptVersion",
  "generatedAt",
] as const;
const UPDATE_HEADERS = [
  "id",
  "transcript",
  "inputHash",
  "model",
  "promptVersion",
  "generatedAt",
] as const;
const AI_HEADERS = [
  "updateId",
  "generatedTaskDescription",
  "inputHash",
  "model",
  "promptVersion",
  "generatedAt",
] as const;
const CURRENT_TASK_HEADERS = ["id", "title", "description"] as const;
const CURRENT_UPDATE_HEADERS = ["id", "transcript"] as const;
const CURRENT_AI_HEADERS = ["updateId", "generatedTaskDescription"] as const;

function sanitizeModelName(model: string): string {
  return model.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

async function readCsvIfExists(filePath: string): Promise<CsvRow[]> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return parseCsv(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function generatedContentRoot(datasetDir: string): string {
  return path.join(datasetDir, "generated-content");
}

export function generatedModelDir(datasetDir: string, model: string): string {
  return path.join(generatedContentRoot(datasetDir), "models", sanitizeModelName(model));
}

export function generatedCurrentDir(datasetDir: string): string {
  return path.join(generatedContentRoot(datasetDir), "current");
}

export async function loadGeneratedContentForModel(datasetDir: string, model: string) {
  const dir = generatedModelDir(datasetDir, model);
  const [tasks, updates, updateAi] = await Promise.all([
    readCsvIfExists(path.join(dir, "tasks.csv")),
    readCsvIfExists(path.join(dir, "updates.csv")),
    readCsvIfExists(path.join(dir, "update_ai_outputs.csv")),
  ]);
  return {
    tasks: tasks as GeneratedTaskContentRow[],
    updates: updates as GeneratedUpdateContentRow[],
    updateAi: updateAi as GeneratedAiContentRow[],
  };
}

export async function applyCurrentGeneratedOverlay(
  datasetDir: string,
  rows: DemoBundleRows
) {
  const dir = generatedCurrentDir(datasetDir);
  const [tasks, updates, updateAi] = await Promise.all([
    readCsvIfExists(path.join(dir, "tasks.csv")),
    readCsvIfExists(path.join(dir, "updates.csv")),
    readCsvIfExists(path.join(dir, "update_ai_outputs.csv")),
  ]);

  const taskMap = new Map(tasks.map((row) => [row.id, row] as const));
  const updateMap = new Map(updates.map((row) => [row.id, row] as const));
  const aiMap = new Map(updateAi.map((row) => [row.updateId, row] as const));

  for (const task of rows.tasks) {
    const overlay = taskMap.get(task.id);
    if (!overlay) continue;
    if (overlay.title?.trim()) task.title = overlay.title.trim();
    if (overlay.description?.trim()) task.description = overlay.description.trim();
  }

  for (const update of rows.updates) {
    const overlay = updateMap.get(update.id);
    if (!overlay) continue;
    if (overlay.transcript?.trim()) update.transcript = overlay.transcript.trim();
  }

  for (const ai of rows.updateAi) {
    const overlay = aiMap.get(ai.updateId);
    if (!overlay) continue;
    if (overlay.generatedTaskDescription?.trim()) {
      ai.generatedTaskDescription = overlay.generatedTaskDescription.trim();
    }
  }
}

export async function persistGeneratedModelContent(
  datasetDir: string,
  model: string,
  content: {
    tasks: GeneratedTaskContentRow[];
    updates: GeneratedUpdateContentRow[];
    updateAi: GeneratedAiContentRow[];
  }
) {
  const dir = generatedModelDir(datasetDir, model);
  await fs.mkdir(dir, { recursive: true });

  await Promise.all([
    fs.writeFile(
      path.join(dir, "tasks.csv"),
      serializeCsv(content.tasks, [...TASK_HEADERS])
    ),
    fs.writeFile(
      path.join(dir, "updates.csv"),
      serializeCsv(content.updates, [...UPDATE_HEADERS])
    ),
    fs.writeFile(
      path.join(dir, "update_ai_outputs.csv"),
      serializeCsv(content.updateAi, [...AI_HEADERS])
    ),
  ]);
}

export async function persistCurrentGeneratedContent(
  datasetDir: string,
  content: {
    tasks: GeneratedTaskContentRow[];
    updates: GeneratedUpdateContentRow[];
    updateAi: GeneratedAiContentRow[];
  }
) {
  const dir = generatedCurrentDir(datasetDir);
  await fs.mkdir(dir, { recursive: true });

  await Promise.all([
    fs.writeFile(
      path.join(dir, "tasks.csv"),
      serializeCsv(
        content.tasks.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
        })),
        [...CURRENT_TASK_HEADERS]
      )
    ),
    fs.writeFile(
      path.join(dir, "updates.csv"),
      serializeCsv(
        content.updates.map((row) => ({
          id: row.id,
          transcript: row.transcript,
        })),
        [...CURRENT_UPDATE_HEADERS]
      )
    ),
    fs.writeFile(
      path.join(dir, "update_ai_outputs.csv"),
      serializeCsv(
        content.updateAi.map((row) => ({
          updateId: row.updateId,
          generatedTaskDescription: row.generatedTaskDescription,
        })),
        [...CURRENT_AI_HEADERS]
      )
    ),
  ]);
}

export async function appendGeneratedBatchLog(
  datasetDir: string,
  model: string,
  log: GeneratedContentBatchLog
) {
  const dir = generatedModelDir(datasetDir, model);
  await fs.mkdir(dir, { recursive: true });
  const logPath = path.join(dir, "batches.jsonl");
  await fs.appendFile(logPath, `${JSON.stringify(log)}\n`);
}

export function contentHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
