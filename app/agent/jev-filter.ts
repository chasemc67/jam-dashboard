import {
  candidateWindows,
  JEV_DEBOUNCE_MS,
  JEV_FAILED_MESSAGE,
  JEV_WINDOW_MAX_WORDS,
  jevConfidenceGate,
  type JevEvaluator,
  type JevGate,
  type JevRequestBody,
} from './jev';

/**
 * Always-on directed-speech filter, adapted from the Jevis `SpeechFilter`.
 *
 * Jam's STT is batch: the mic is cut into pause-delimited segments, each
 * re-transcribed for interims and then once more for a final. Each segment is
 * one Jevis "region" (Jevis also seals regions at STT endpoints). Every text
 * revision revokes permission to submit until its own Jev decision arrives;
 * a region is submitted at most once, only after its final transcript, a
 * fresh directed decision, and a quiet interval since its last detected
 * speech. Errors, timeouts, and unclear answers hold (fail closed).
 */

export type JevTranscriptSegment = {
  index: number;
  text: string;
  final: boolean;
  /** Last time the mic heard speech in this segment (ms, same clock). */
  lastSpeechAt?: number;
};

export type JevHoldReason = 'ambient' | 'unclear' | 'error';

export type JevSegmentOutcome =
  | { status: 'sent'; startWord: number; text: string; at: number }
  | { status: 'held'; reason: JevHoldReason };

export type JevSubmission = {
  text: string;
  segment: number;
  startWord: number;
};

export interface JevClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const systemClock: JevClock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

type Region = {
  segment: number;
  words: string[];
  key: string;
  final: boolean;
  lastSpeechAt: number;
  seq: number;
  startIndex: number | null;
  excludedBefore: number;
  gate: JevGate;
  appliedSeq: number;
  error: string | null;
  timer: unknown;
};

type Job = { region: Region; seq: number; body: JevRequestBody };

export function splitTranscriptWords(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

/** Case and punctuation differences between interim and final don't count as revisions. */
function contentKey(words: readonly string[]) {
  return words
    .map(word => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''))
    .filter(Boolean)
    .join(' ');
}

export class JevSpeechFilter {
  private readonly regions = new Map<number, Region>();
  private readonly results = new Map<number, JevSegmentOutcome>();
  private readonly jobs = new Map<number, Job>();
  /** Segments already submitted, held, or empty; later revisions are ignored. */
  private readonly retired = new Set<number>();
  private flight: { job: Job; controller: AbortController } | null = null;
  private idleWaiters: (() => void)[] = [];
  private nextSeq = 1;
  private flushing = false;
  private stopped = false;
  private readonly evaluate: JevEvaluator;
  private readonly onSubmit: (submission: JevSubmission) => void;
  private readonly onChange: () => void;
  private readonly onError: (message: string) => void;
  private readonly clock: JevClock;
  private readonly debounceMs: number;

  constructor(options: {
    evaluate: JevEvaluator;
    onSubmit: (submission: JevSubmission) => void;
    onChange?: () => void;
    onError?: (message: string) => void;
    clock?: JevClock;
    debounceMs?: number;
  }) {
    this.evaluate = options.evaluate;
    this.onSubmit = options.onSubmit;
    this.onChange = options.onChange ?? (() => {});
    this.onError = options.onError ?? (() => {});
    this.clock = options.clock ?? systemClock;
    this.debounceMs = options.debounceMs ?? JEV_DEBOUNCE_MS;
  }

  /** Per-segment decisions so far; segments without one are still live. */
  outcomes(): ReadonlyMap<number, JevSegmentOutcome> {
    return this.results;
  }

  get evaluating() {
    return this.flight !== null || this.jobs.size > 0;
  }

  update(segments: readonly JevTranscriptSegment[]) {
    if (this.stopped) return;
    for (const segment of segments) {
      if (this.retired.has(segment.index)) continue;
      const words = splitTranscriptWords(segment.text);
      let region = this.regions.get(segment.index);
      if (!region) {
        if (!words.length && !segment.final) continue;
        region = this.createRegion(
          segment.index,
          segment.lastSpeechAt ?? this.clock.now(),
        );
      }
      if (segment.lastSpeechAt !== undefined) {
        region.lastSpeechAt = Math.max(
          region.lastSpeechAt,
          segment.lastSpeechAt,
        );
      }
      region.final = region.final || segment.final;
      const key = contentKey(words);
      if (key !== region.key) {
        region.words = words;
        region.key = key;
        region.seq = this.nextSeq++;
        // Any revision revokes permission to submit until re-evaluated.
        region.gate = { kind: 'unclear' };
        region.appliedSeq = -1;
        region.error = null;
        region.excludedBefore = Math.min(region.excludedBefore, words.length);
        if (region.startIndex !== null && region.startIndex >= words.length) {
          region.startIndex = null;
        }
        this.request(region);
      } else {
        // Same content: keep the decision, adopt final punctuation/casing.
        region.words = words;
      }
      this.tryEmit(region);
    }
    this.onChange();
  }

  /**
   * Mic stopped: nothing more will be heard, so skip the remaining quiet
   * interval, wait for in-flight decisions, then submit or hold every region.
   */
  async finish() {
    if (this.stopped) return;
    this.flushing = true;
    for (const region of this.regions.values()) {
      region.final = true;
      this.tryEmit(region);
    }
    while (this.evaluating && !this.stopped) {
      await new Promise<void>(resolve => this.idleWaiters.push(resolve));
    }
    for (const region of [...this.regions.values()]) this.tryEmit(region);
    for (const region of [...this.regions.values()]) this.hold(region);
    this.onChange();
  }

  /** Cancels everything without submitting. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.jobs.clear();
    this.flight?.controller.abort();
    for (const region of this.regions.values()) {
      this.clock.clearTimeout(region.timer);
    }
    this.regions.clear();
    this.resolveIdle();
  }

  private createRegion(segment: number, lastSpeechAt: number): Region {
    const region: Region = {
      segment,
      words: [],
      key: '',
      final: false,
      lastSpeechAt,
      seq: 0,
      startIndex: null,
      excludedBefore: 0,
      gate: { kind: 'unclear' },
      appliedSeq: -1,
      error: null,
      timer: undefined,
    };
    this.regions.set(segment, region);
    return region;
  }

  private request(region: Region) {
    const candidates = candidateWindows(
      region.words,
      region.startIndex,
      region.excludedBefore,
    );
    if (this.flight?.job.region === region) this.flight.controller.abort();
    if (!candidates.length) {
      this.jobs.delete(region.segment);
      // Nothing left to evaluate: every word was already excluded.
      region.gate =
        region.words.length > 0 ? { kind: 'ambient' } : { kind: 'unclear' };
      region.appliedSeq = region.seq;
      return;
    }
    this.jobs.set(region.segment, {
      region,
      seq: region.seq,
      body: {
        context: region.words.slice(-JEV_WINDOW_MAX_WORDS).join(' '),
        candidates,
      },
    });
    this.pump();
  }

  private nextJob() {
    let best: Job | undefined;
    for (const job of this.jobs.values()) {
      // Finished segments first: they are the ones waiting to submit.
      if (
        !best ||
        (job.region.final && !best.region.final) ||
        (job.region.final === best.region.final &&
          job.region.segment < best.region.segment)
      ) {
        best = job;
      }
    }
    return best;
  }

  private pump() {
    if (this.flight || this.stopped) return;
    const job = this.nextJob();
    if (!job) {
      this.resolveIdle();
      return;
    }
    this.jobs.delete(job.region.segment);
    const controller = new AbortController();
    this.flight = { job, controller };
    // The slot is held until the request settles, even when aborted, so two
    // evaluations never overlap.
    void (async () => {
      try {
        const result = await this.evaluate(job.body, controller.signal);
        if (!this.isCurrent(job, controller.signal)) return;
        this.apply(
          job,
          jevConfidenceGate(result, job.body.candidates),
          result.error,
        );
      } catch {
        if (this.isCurrent(job, controller.signal)) {
          this.apply(job, { kind: 'unclear' }, JEV_FAILED_MESSAGE);
        }
      } finally {
        this.flight = null;
        if (!this.stopped) {
          this.tryEmit(job.region);
          this.onChange();
        }
        this.pump();
      }
    })();
  }

  private isCurrent(job: Job, signal: AbortSignal) {
    return (
      !signal.aborted &&
      !this.stopped &&
      this.regions.get(job.region.segment) === job.region &&
      job.region.seq === job.seq
    );
  }

  private apply(job: Job, gate: JevGate, error: string | undefined) {
    const { region } = job;
    region.gate = gate;
    region.appliedSeq = job.seq;
    region.error = error ?? null;
    if (gate.kind === 'directed') region.startIndex = gate.startIndex;
    if (gate.kind === 'ambient') {
      region.startIndex = null;
      region.excludedBefore = region.words.length;
    }
    if (error) this.onError(error);
  }

  private pending(region: Region) {
    return this.jobs.has(region.segment) || this.flight?.job.region === region;
  }

  private tryEmit(region: Region) {
    if (this.stopped || this.regions.get(region.segment) !== region) return;
    this.clock.clearTimeout(region.timer);
    region.timer = undefined;
    if (!region.words.length) {
      if (region.final) this.retire(region);
      return;
    }
    if (!region.final || this.pending(region)) return;
    if (region.appliedSeq !== region.seq) return;
    if (!this.flushing) {
      const quietFor = this.clock.now() - region.lastSpeechAt;
      if (quietFor < this.debounceMs) {
        region.timer = this.clock.setTimeout(() => {
          this.tryEmit(region);
          this.onChange();
        }, this.debounceMs - quietFor);
        return;
      }
    }
    const { gate } = region;
    if (gate.kind === 'directed' && gate.startIndex >= region.excludedBefore) {
      const text = region.words.slice(gate.startIndex).join(' ').trim();
      if (text) {
        this.results.set(region.segment, {
          status: 'sent',
          startWord: gate.startIndex,
          text,
          at: this.clock.now(),
        });
        this.retire(region);
        this.onSubmit({
          text,
          segment: region.segment,
          startWord: gate.startIndex,
        });
        return;
      }
    }
    this.hold(region);
  }

  private hold(region: Region) {
    if (this.regions.get(region.segment) !== region) return;
    if (region.words.length) {
      const reason: JevHoldReason = region.error
        ? 'error'
        : region.appliedSeq === region.seq && region.gate.kind === 'ambient'
          ? 'ambient'
          : 'unclear';
      this.results.set(region.segment, { status: 'held', reason });
    }
    this.retire(region);
  }

  private retire(region: Region) {
    this.clock.clearTimeout(region.timer);
    this.jobs.delete(region.segment);
    this.regions.delete(region.segment);
    this.retired.add(region.segment);
  }

  private resolveIdle() {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    waiters.forEach(resolve => resolve());
  }
}
