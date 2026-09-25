import {
  splitTranscriptWords,
  type JevSegmentOutcome,
  type JevTranscriptSegment,
} from './jev-filter';

export type JevLineStatus =
  | 'listening'
  | 'sent'
  | 'ambient'
  | 'unclear'
  | 'error'
  | 'unsent';

export type JevTranscriptPiece = { text: string; sent: boolean };

export type JevTranscriptLine = {
  segment: number;
  status: JevLineStatus;
  /** Whole segment text, in order. */
  text: string;
  pieces: JevTranscriptPiece[];
  /** Exactly what was auto-sent to chat, if anything. */
  sentText: string | null;
  /** The words that did not reach chat (for copying a miss). */
  unsentText: string;
};

export const JEV_LINE_STATUS_LABEL: Record<JevLineStatus, string> = {
  listening: 'Listening…',
  sent: 'Sent to chat',
  ambient: 'Not for the assistant',
  unclear: 'Unsure, not sent',
  error: 'Classifier error, not sent',
  unsent: 'Not sent',
};

/**
 * Pairs every transcribed segment with its Jev outcome and splits it into
 * sent / not-sent pieces for highlighting. While `live`, undecided segments
 * are still listening; afterwards they are reported as not sent.
 */
export function buildJevTranscriptLines(
  segments: readonly JevTranscriptSegment[],
  outcomes: ReadonlyMap<number, JevSegmentOutcome>,
  { live }: { live: boolean },
): JevTranscriptLine[] {
  const lines: JevTranscriptLine[] = [];
  for (const segment of [...segments].sort((a, b) => a.index - b.index)) {
    const words = splitTranscriptWords(segment.text);
    if (!words.length) continue;
    const text = words.join(' ');
    const outcome = outcomes.get(segment.index);
    if (outcome?.status === 'sent') {
      const start = Math.min(Math.max(outcome.startWord, 0), words.length);
      const before = words.slice(0, start).join(' ');
      const sent = words.slice(start).join(' ') || outcome.text;
      lines.push({
        segment: segment.index,
        status: 'sent',
        text,
        pieces: [
          ...(before ? [{ text: before, sent: false }] : []),
          { text: sent, sent: true },
        ],
        sentText: outcome.text,
        unsentText: before,
      });
      continue;
    }
    const status: JevLineStatus =
      outcome?.status === 'held'
        ? outcome.reason
        : live
          ? 'listening'
          : 'unsent';
    lines.push({
      segment: segment.index,
      status,
      text,
      pieces: [{ text, sent: false }],
      sentText: null,
      unsentText: text,
    });
  }
  return lines;
}

export function jevTranscriptText(lines: readonly JevTranscriptLine[]) {
  return lines.map(line => line.text).join('\n');
}

export function jevTranscriptSummary(lines: readonly JevTranscriptLine[]) {
  const sent = lines.filter(line => line.status === 'sent').length;
  return { total: lines.length, sent, notSent: lines.length - sent };
}
