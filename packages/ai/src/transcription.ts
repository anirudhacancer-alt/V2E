/**
 * Transcription Service
 *
 * Handles audio-to-text transcription via ai-gateway.
 */

import { GatewayClient, gatewayClient } from "./client.js";
import {
  type TranscriptionRequest,
  type TranscriptionResponse,
  TranscriptionError,
} from "./types.js";

/**
 * Transcription Service
 *
 * Converts audio recordings to text using Azure Speech or Whisper models.
 */
export class TranscriptionService {
  private client: GatewayClient;

  constructor(client?: GatewayClient) {
    this.client = client || gatewayClient;
  }

  /**
   * Transcribe audio to text
   *
   * @param request - Transcription request with audio data
   * @returns Transcription response with text and metadata
   */
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    // Validate request
    if (!request.audioBase64 && !request.audioUrl) {
      throw new TranscriptionError(
        "Either audioBase64 or audioUrl must be provided",
        "INVALID_REQUEST"
      );
    }

    const startTime = Date.now();
    const modelId = this.client.resolveModel(request.model || "transcription");

    try {
      // Prepare form data for audio transcription
      const formData = new FormData();

      if (request.audioBase64) {
        // Convert base64 to blob
        const mimeType = request.mimeType || "audio/webm";
        const binaryString = atob(request.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        formData.append("file", blob, `audio.${mimeType.split("/")[1]}`);
      } else if (request.audioUrl) {
        // Fetch audio from URL
        const audioResponse = await fetch(request.audioUrl);
        if (!audioResponse.ok) {
          throw new TranscriptionError(
            "Failed to fetch audio from URL",
            "AUDIO_FETCH_ERROR",
            audioResponse.status
          );
        }
        const blob = await audioResponse.blob();
        formData.append("file", blob, "audio.webm");
      }

      formData.append("model", modelId);
      if (request.language) {
        formData.append("language", request.language);
      }

      // Make request to gateway
      // Note: The actual transcription endpoint needs to be implemented in ai-gateway
      const response = await fetch(`${this.client.baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new TranscriptionError(
          errorBody.error?.message || `HTTP ${response.status}`,
          errorBody.error?.code || "TRANSCRIPTION_ERROR",
          response.status,
          errorBody.error?.details
        );
      }

      const result = await response.json() as {
        text: string;
        language?: string;
        duration?: number;
      };

      return {
        text: result.text,
        language: result.language || request.language || "en",
        duration: result.duration,
        modelUsed: modelId,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof TranscriptionError) {
        throw error;
      }
      throw new TranscriptionError(
        (error as Error).message || "Transcription failed",
        "TRANSCRIPTION_ERROR"
      );
    }
  }
}

// Export singleton instance
export const transcriptionService = new TranscriptionService();
