/**
 * Dictation into the chat composer on top of batch STT (`/api/agent-transcribe`
 * has no streaming mode). The recorder emits timesliced chunks; the current
 * segment is re-transcribed periodically for a live interim, and segments are
 * cut at speech pauses (or a hard cap) so each gets one final transcription and
 * re-transcription cost stays bounded by the segment length.
 */
export const VOICE_TIMESLICE_MS = 500;
export const VOICE_TICK_MS = 200;
export const VOICE_INTERIM_INTERVAL_MS = 1500;
export const VOICE_SEGMENT_MIN_MS = 3000;
export const VOICE_SEGMENT_MAX_MS = 15_000;
export const VOICE_SILENCE_ROTATE_MS = 700;
/** Raw RMS (not the 4x meter level) above which a frame counts as speech. */
export const VOICE_SPEECH_RMS = 0.01;

export function appendDictation(draft: string, transcript: string) {
  const text = transcript.trim();
  if (!text) return draft;
  if (!draft.trim()) return text;
  return /\s$/.test(draft) ? `${draft}${text}` : `${draft} ${text}`;
}

export function shouldRotateSegment({
  segmentMs,
  silentMs,
  heardSpeech,
}: {
  segmentMs: number;
  silentMs: number;
  heardSpeech: boolean;
}) {
  if (segmentMs >= VOICE_SEGMENT_MAX_MS) return true;
  return (
    heardSpeech &&
    segmentMs >= VOICE_SEGMENT_MIN_MS &&
    silentMs >= VOICE_SILENCE_ROTATE_MS
  );
}

export function shouldRequestInterim({
  sinceLastMs,
  inFlight,
  hasNewAudio,
  heardSpeech,
}: {
  sinceLastMs: number;
  inFlight: boolean;
  hasNewAudio: boolean;
  heardSpeech: boolean;
}) {
  return (
    !inFlight &&
    hasNewAudio &&
    heardSpeech &&
    sinceLastMs >= VOICE_INTERIM_INTERVAL_MS
  );
}

/**
 * Orders per-segment results that may resolve out of order. A final result
 * always wins over interims for its segment; older interims never overwrite
 * newer ones.
 */
export class DictationTranscript {
  private finals = new Map<number, string>();
  private interims = new Map<number, { seq: number; text: string }>();

  setInterim(segment: number, seq: number, text: string) {
    if (this.finals.has(segment)) return false;
    const current = this.interims.get(segment);
    if (current && current.seq >= seq) return false;
    this.interims.set(segment, { seq, text: text.trim() });
    return true;
  }

  setFinal(segment: number, text: string) {
    this.finals.set(segment, text.trim());
    this.interims.delete(segment);
  }

  interimText(segment: number) {
    return this.interims.get(segment)?.text ?? '';
  }

  segments() {
    const indices = new Set([...this.finals.keys(), ...this.interims.keys()]);
    return [...indices]
      .sort((a, b) => a - b)
      .map(index => ({
        index,
        text: this.finals.get(index) ?? this.interimText(index),
        final: this.finals.has(index),
      }));
  }

  text() {
    return this.segments()
      .map(segment => segment.text)
      .filter(Boolean)
      .join(' ');
  }
}
