import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, CornerDownLeft } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  JEV_LINE_STATUS_LABEL,
  jevTranscriptSummary,
  jevTranscriptText,
  type JevTranscriptLine,
} from '~/agent/jev-transcript';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function useCopied() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const copy = async (id: string, text: string) => {
    if (!(await copyText(text))) return;
    setCopied(id);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1500);
  };
  return { copied, copy };
}

/**
 * Full Jev-mode session transcript. Spans that were auto-sent to chat are
 * highlighted; everything else can be copied or added to the message box when
 * the classifier missed a request.
 */
export default function JevTranscript({
  lines,
  live,
  evaluating = false,
  onBack,
  onUseText,
}: {
  lines: JevTranscriptLine[];
  /** The Jev mic is still on. */
  live: boolean;
  evaluating?: boolean;
  onBack: () => void;
  /** Adds text to the chat message box. */
  onUseText: (text: string) => void;
}) {
  const { copied, copy } = useCopied();
  const summary = jevTranscriptSummary(lines);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (live && list) list.scrollTop = list.scrollHeight;
  }, [lines, live]);

  return (
    <section
      aria-label="Jev transcript"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Chat
        </Button>
        <p
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          role="status"
        >
          {summary.total === 0
            ? live
              ? 'Listening…'
              : 'Nothing transcribed yet'
            : `${summary.sent} sent · ${summary.notSent} not sent${
                evaluating ? ' · checking…' : ''
              }`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={summary.total === 0}
          onClick={() => void copy('all', jevTranscriptText(lines))}
        >
          {copied === 'all' ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied === 'all' ? 'Copied' : 'Copy all'}
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-3 px-4 pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <mark className="rounded bg-primary/25 px-1 text-foreground">
            text
          </mark>
          sent to chat
        </span>
        <span>plain text was not sent</span>
      </div>
      <ol
        ref={listRef}
        aria-label="Transcribed speech"
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3 select-text"
      >
        {lines.map(line => {
          const missed = line.unsentText.trim();
          return (
            <li
              key={line.segment}
              data-status={line.status}
              className={cn(
                'group rounded-md border px-3 py-2',
                line.status === 'sent'
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border',
              )}
            >
              <p className="text-sm leading-relaxed">
                {line.pieces.map((piece, index) => (
                  <Fragment key={index}>
                    {index > 0 && ' '}
                    {piece.sent ? (
                      <mark className="rounded bg-primary/25 px-0.5 text-foreground">
                        {piece.text}
                      </mark>
                    ) : (
                      <span
                        className={cn(
                          line.status !== 'listening' &&
                            'text-muted-foreground',
                        )}
                      >
                        {piece.text}
                      </span>
                    )}
                  </Fragment>
                ))}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-[11px] font-medium uppercase tracking-wide',
                    line.status === 'sent'
                      ? 'text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  {JEV_LINE_STATUS_LABEL[line.status]}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    aria-label={`Copy “${line.text}”`}
                    onClick={() => void copy(`line-${line.segment}`, line.text)}
                  >
                    {copied === `line-${line.segment}` ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copied === `line-${line.segment}` ? 'Copied' : 'Copy'}
                  </Button>
                  {missed && line.status !== 'listening' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      aria-label={`Add “${missed}” to message`}
                      title="Add the unsent words to the message box"
                      onClick={() => onUseText(missed)}
                    >
                      <CornerDownLeft
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Add to message
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
