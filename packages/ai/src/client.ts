/**
 * AI Gateway Client
 *
 * Core HTTP client for communicating with ai-gateway.
 */

import {
  type GatewayConfig,
  type ModelId,
  type V2EModelAlias,
  MODEL_MAPPING,
  GatewayError,
} from "./types.js";

const DEFAULT_CONFIG: Required<Omit<GatewayConfig, "apiKey">> & { apiKey?: string } = {
  baseUrl: process.env.AI_GATEWAY_URL || "http://localhost:4000",
  timeout: 30000,
  retries: 3,
  apiKey: process.env.AI_GATEWAY_API_KEY,
};

/**
 * AI Gateway Client
 *
 * Handles HTTP communication with the ai-gateway service.
 */
export class GatewayClient {
  private config: Required<Omit<GatewayConfig, "apiKey">> & { apiKey?: string };

  constructor(config?: Partial<GatewayConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Resolve a V2E model alias to the actual model ID from providers.yaml
   */
  resolveModel(modelOrAlias: V2EModelAlias | ModelId): ModelId {
    if (modelOrAlias in MODEL_MAPPING) {
      return MODEL_MAPPING[modelOrAlias as V2EModelAlias];
    }
    return modelOrAlias;
  }

  /**
   * Get the base URL for the gateway
   */
  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Make a request to the gateway with retry logic
   */
  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new GatewayError(
            errorBody.error?.message || `HTTP ${response.status}`,
            errorBody.error?.code || "HTTP_ERROR",
            response.status,
            errorBody.error?.details
          );
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (error instanceof GatewayError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        // Don't retry on abort (timeout)
        if ((error as Error).name === "AbortError") {
          throw new GatewayError(
            "Request timed out",
            "TIMEOUT",
            undefined,
            { timeout: this.config.timeout }
          );
        }

        // Wait before retry with exponential backoff
        if (attempt < this.config.retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new GatewayError("Request failed", "UNKNOWN");
  }

  /**
   * POST request helper
   */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * GET request helper
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  /**
   * Check if the gateway is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get<{ status: string }>("/health");
      return response.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * List available models from the gateway
   */
  async listModels(): Promise<{ models: string[] }> {
    return this.get("/v1/models");
  }
}

// Export singleton instance with default config
export const gatewayClient = new GatewayClient();
