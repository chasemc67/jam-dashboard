import { useEffect, useState } from 'react';
import { useAgent } from '~/contexts/AgentContext';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

export default function VoicingControls() {
  const { controller, display } = useAgent();
  const [chord, setChord] = useState('C');
  const [error, setError] = useState('');
  useEffect(() => {
    if (display.chord) setChord(display.chord);
    setError('');
  }, [display.chord]);
  const result = display.result;
  const index = display.selectedIndex ?? 0;
  const run = async (action: Parameters<typeof controller.execute>[0]) => {
    try {
      await controller.execute(action);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to show voicings.');
    }
  };
  return (
    <div className="mb-4 max-w-2xl space-y-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={e => {
          e.preventDefault();
          void run({ type: 'show_voicings', input: { chord } });
        }}
      >
        <label htmlFor="voicing-chord" className="text-sm">
          Chord voicings
        </label>
        <Input
          id="voicing-chord"
          value={chord}
          onChange={e => setChord(e.target.value)}
          className="w-28 h-8"
          placeholder="C, Am7, C/E"
        />
        <Button type="submit" size="sm" variant="outline">
          Show voicings
        </Button>
        {display.kind !== 'scale' && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void run({ type: 'show_fretboard', input: {} })}
          >
            Show scale
          </Button>
        )}
      </form>
      {result && (
        <div className="space-y-2" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{result.chord.symbol}</strong>
            <Button
              size="sm"
              variant="outline"
              disabled={index === 0}
              onClick={() =>
                void run({
                  type: 'select_voicing',
                  input: { index: index - 1 },
                })
              }
            >
              Previous
            </Button>
            <select
              aria-label="Selected voicing"
              className="bg-background border rounded p-1"
              value={index}
              onChange={e =>
                void run({
                  type: 'select_voicing',
                  input: { index: Number(e.target.value) },
                })
              }
            >
              {result.voicings.map((v, i) => (
                <option key={v.id} value={i}>
                  {i + 1} of {result.voicings.length} · {v.id}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={index === result.voicings.length - 1}
              onClick={() =>
                void run({
                  type: 'select_voicing',
                  input: { index: index + 1 },
                })
              }
            >
              Next
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {result.truncated
              ? `Showing ${result.voicings.length} results; search stopped at the ${result.stopReason === 'result_limit' ? 'result' : 'work'} limit.`
              : `All ${result.voicings.length} results within these constraints.`}{' '}
            Frets {result.options.minFret}–{result.options.maxFret}, span ≤{' '}
            {result.options.maxSpan}. E standard · high to low · × muted · ○
            open. Fingerings are not ranked for playability.
          </p>
        </div>
      )}
      {!result && display.chord && (
        <p className="text-sm">Showing {display.chord}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-feedback-incorrect">
          {error}
        </p>
      )}
    </div>
  );
}
