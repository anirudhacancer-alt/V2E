#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CONTRACTS,
  resolveAnchorDate,
} from "./demo-seed/config.js";
import { loadDemoBundle } from "./demo-seed/csv-bundle.js";
import {
  generateBundleContentForModel,
  type DemoContentGenerationOptions,
} from "./demo-seed/content-enrichment.js";
import { materializeDemoBundle } from "./demo-seed/materialize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

function parseArgs(argv: string[]) {
  let repoRoot = path.resolve(pkgRoot, "../..");
  let contracts = [...DEFAULT_CONTRACTS];
  let anchorDateInput: string | undefined;
  let models = (
    process.env.DEMO_CONTENT_MODELS || "nano-gpt-minimax-m2-7"
  )
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  let publishModel = process.env.DEMO_CONTENT_PUBLISH_MODEL || models[0] || "";
  let batchSize = Number(process.env.DEMO_CONTENT_BATCH_SIZE || 20);
  let maxBatches = Number(process.env.DEMO_CONTENT_MAX_BATCHES || 0);
  let temperature = Number(process.env.DEMO_CONTENT_TEMPERATURE || 0.35);
  let timeoutMs = Number(process.env.DEMO_CONTENT_TIMEOUT_MS || 60000);
  let promptVersion = process.env.DEMO_CONTENT_PROMPT_VERSION || "construction_v1";
  let force = process.env.DEMO_CONTENT_FORCE === "1";

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--repo-root" && val) {
      repoRoot = path.resolve(val);
      i += 1;
    } else if (key === "--contracts" && val) {
      contracts = val
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      i += 1;
    } else if (key === "--anchor-date" && val) {
      anchorDateInput = val;
      i += 1;
    } else if (key === "--models" && val) {
      models = val
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      i += 1;
    } else if (key === "--publish-model" && val) {
      publishModel = val.trim();
      i += 1;
    } else if (key === "--batch-size" && val) {
      batchSize = Number(val);
      i += 1;
    } else if (key === "--max-batches" && val) {
      maxBatches = Number(val);
      i += 1;
    } else if (key === "--temperature" && val) {
      temperature = Number(val);
      i += 1;
    } else if (key === "--timeout-ms" && val) {
      timeoutMs = Number(val);
      i += 1;
    } else if (key === "--prompt-version" && val) {
      promptVersion = val.trim();
      i += 1;
    } else if (key === "--force") {
      force = true;
    }
  }

  if (models.length === 0) {
    throw new Error("No models provided. Use --models model1,model2");
  }
  if (!publishModel) {
    publishModel = models[0];
  }
  if (!Number.isFinite(batchSize) || batchSize < 1) {
    throw new Error(`Invalid --batch-size: ${batchSize}`);
  }
  if (!Number.isFinite(maxBatches) || maxBatches < 0) {
    throw new Error(`Invalid --max-batches: ${maxBatches}`);
  }
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1.5) {
    throw new Error(`Invalid --temperature: ${temperature}`);
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    throw new Error(`Invalid --timeout-ms: ${timeoutMs}`);
  }

  return {
    repoRoot,
    contracts,
    anchorDateInput,
    models,
    publishModel,
    batchSize,
    maxBatches,
    temperature,
    timeoutMs,
    promptVersion,
    force,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const anchorDate = resolveAnchorDate(args.anchorDateInput);

  for (const contractId of args.contracts) {
    console.log(
      `Generating persisted content for ${contractId} relative to ${anchorDate.toISOString().slice(0, 10)}...`
    );
    const loaded = await loadDemoBundle(args.repoRoot, contractId, {
      includeGeneratedOverlay: false,
    });

    const results = await Promise.allSettled(
      args.models.map(async (model) => {
        const materialized = materializeDemoBundle(loaded, anchorDate);
        const options: DemoContentGenerationOptions = {
          model,
          batchSize: args.batchSize,
          maxBatches: args.maxBatches || undefined,
          temperature: args.temperature,
          timeoutMs: args.timeoutMs,
          promptVersion: args.promptVersion,
          publish: model === args.publishModel,
          force: args.force,
          gatewayUrl: process.env.AI_GATEWAY_URL,
          apiKey: process.env.AI_GATEWAY_API_KEY,
        };
        console.log(
          `Model ${model}${options.publish ? " (publishing current overlay)" : ""}`
        );
        await generateBundleContentForModel(materialized, anchorDate, options);
      })
    );

    const failures = results
      .map((result, index) => ({ result, model: args.models[index] }))
      .filter(
        (entry): entry is {
          result: PromiseRejectedResult;
          model: string;
        } => entry.result.status === "rejected"
      );

    if (failures.length > 0) {
      failures.forEach((failure) => {
        console.error(
          `Model ${failure.model} failed: ${
            failure.result.reason instanceof Error
              ? failure.result.reason.message
              : String(failure.result.reason)
          }`
        );
      });
      throw new Error(
        `Content generation failed for ${failures.length}/${args.models.length} models`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
