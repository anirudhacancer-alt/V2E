/**
 * Transcript placeholder for audio updates before STT runs.
 * Keep in sync with recording flow — used by review UI to show "Generate Transcript".
 */
export const AUDIO_TRANSCRIPT_PENDING_PLACEHOLDER =
  "(Audio recorded — pending transcription)";

export function isPendingAudioTranscript(transcript: string | null | undefined): boolean {
  if (!transcript?.trim()) return false;
  return transcript.trim() === AUDIO_TRANSCRIPT_PENDING_PLACEHOLDER;
}
