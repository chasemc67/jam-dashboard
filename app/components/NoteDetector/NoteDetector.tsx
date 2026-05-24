import { useState, useMemo } from 'react';
import { Mic, MicOff, RefreshCw, Shield, Trash2, X } from 'lucide-react';
import { Note, Chord } from 'tonal';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  useNoteDetection,
  type UseNoteDetectionReturn,
} from '~/hooks/useNoteDetection';
import { generate_key_options } from '~/components/KeyPicker/KeyPicker';
import { useSettings } from '~/contexts/SettingsContext';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import { useHighlight } from '~/contexts/HighlightContext';
import { filteredScaleTypes } from '~/utils/scaleTypes';

function NoteChip({
  note,
  onRemove,
  onClick,
}: {
  note: string;
  onRemove?: () => void;
  onClick?: () => void;
}) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      className={cn(
        'group inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-sm font-medium text-secondary-foreground',
        onClick && 'cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors',
      )}
    >
      {note}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-1 hidden rounded-sm opacity-60 hover:opacity-100 group-hover:inline-flex"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function SegmentedToggle({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-input bg-background p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-secondary text-secondary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface NoteDetectorUIProps {
  detection: UseNoteDetectionReturn;
}

function useMatchingKeysAndChords(notes: string[]) {
  const { settings } = useSettings();

  const uniqueNotes = useMemo(() => Array.from(new Set(notes)), [notes]);

  const matchingKeys = useMemo(() => {
    if (uniqueNotes.length === 0) return [];

    const enabledScaleTypes: string[] = [];
    if (settings.showMajorMinorScales) {
      enabledScaleTypes.push(...filteredScaleTypes.simple);
    }
    if (settings.showHarmonicMelodicScales) {
      enabledScaleTypes.push(...filteredScaleTypes.minors);
    }
    if (settings.showModes) {
      enabledScaleTypes.push(...filteredScaleTypes.modes);
    }
    if (enabledScaleTypes.length === 0) {
      enabledScaleTypes.push(...filteredScaleTypes.simple);
    }

    const allOptions = generate_key_options(enabledScaleTypes);
    return allOptions.filter((option) =>
      uniqueNotes.every((searchNote) =>
        option.scale.some(
          (scaleNote) =>
            Note.simplify(scaleNote) === Note.simplify(searchNote),
        ),
      ),
    );
  }, [uniqueNotes, settings.showMajorMinorScales, settings.showHarmonicMelodicScales, settings.showModes]);

  const matchingChords = useMemo(() => {
    if (uniqueNotes.length < 2) return [];
    return Chord.detect(uniqueNotes);
  }, [uniqueNotes]);

  return { matchingKeys, matchingChords };
}

function NoteDetectorUI({ detection }: NoteDetectorUIProps) {
  const {
    status,
    error,
    hasPermission,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    currentNote,
    noteLog,
    requestPermission,
    start,
    stop,
    clearLog,
    removeNoteAtIndex,
    removeAllOfNote,
    refreshDevices,
  } = detection;

  const [showUnique, setShowUnique] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'keys' | 'chords'>('keys');
  const isListening = status === 'listening';
  const isRequesting = status === 'requesting';

  const uniqueNotes = Array.from(new Set(noteLog));
  const displayedNotes = showUnique ? uniqueNotes : noteLog;

  const { matchingKeys, matchingChords } = useMatchingKeysAndChords(noteLog);
  const { setKeyScale } = useScaleKey();
  const { setChordHighlight } = useHighlight();

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Error display */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Detected notes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">
              Detected Notes
            </h3>
            <span className="text-lg font-bold text-primary tabular-nums">
              {currentNote ?? '--'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedToggle
              value={showUnique ? 'unique' : 'all'}
              onChange={(v) => setShowUnique(v === 'unique')}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Unique', value: 'unique' },
              ]}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLog}
              disabled={noteLog.length === 0}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
        </div>

        <div className="min-h-[4rem] rounded-lg border border-border bg-card p-3">
          {displayedNotes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {displayedNotes.map((note, i) => (
                <NoteChip
                  key={`${note}-${i}`}
                  note={note}
                  onRemove={
                    showUnique
                      ? () => removeAllOfNote(note)
                      : () => removeNoteAtIndex(i)
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isListening
                ? 'Waiting for notes...'
                : 'Start listening to detect notes'}
            </p>
          )}
        </div>
      </div>

      {/* Key / Chord analysis */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            Analysis
          </h3>
          <SegmentedToggle
            value={analysisMode}
            onChange={(v) => setAnalysisMode(v as 'keys' | 'chords')}
            options={[
              { label: 'Keys', value: 'keys' },
              { label: 'Chords', value: 'chords' },
            ]}
          />
        </div>

        <div className="min-h-[6rem] rounded-lg border border-border bg-card p-3">
          {uniqueNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Play some notes to detect matching{' '}
              {analysisMode === 'keys' ? 'keys' : 'chords'}
            </p>
          ) : analysisMode === 'keys' ? (
            matchingKeys.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {matchingKeys.map((k) => (
                  <NoteChip
                    key={k.value}
                    note={k.value}
                    onClick={() => setKeyScale(k.value)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No matching keys found
              </p>
            )
          ) : matchingChords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {matchingChords.map((c) => (
                <NoteChip
                  key={c}
                  note={c}
                  onClick={() => {
                    const chordNotes = Chord.get(c).notes;
                    if (chordNotes.length > 0) setChordHighlight(chordNotes);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {uniqueNotes.length < 2
                ? 'Play at least 2 notes to detect chords'
                : 'No matching chords found'}
            </p>
          )}
        </div>
      </div>

      {/* Audio controls — compact, at the bottom */}
      {!hasPermission ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Microphone access required
          </span>
          <Button size="sm" onClick={requestPermission}>
            <Mic className="mr-1 h-3 w-3" />
            Allow
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Select
            value={selectedDeviceId ?? undefined}
            onValueChange={(v) => setSelectedDeviceId(v || null)}
            disabled={isListening}
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="Select audio input..." />
            </SelectTrigger>
            <SelectContent>
              {devices.length > 0 ? (
                devices.map((d, i) => (
                  <SelectItem
                    key={d.deviceId || `device-${i}`}
                    value={d.deviceId || `device-${i}`}
                  >
                    {d.label || `Audio Input ${i + 1}`}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__none" disabled>
                  No devices found
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refreshDevices}
            disabled={isListening}
            title="Refresh audio devices"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {isListening ? (
            <Button variant="destructive" size="sm" className="h-8" onClick={stop}>
              <MicOff className="mr-1 h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button size="sm" className="h-8" onClick={start} disabled={isRequesting}>
              <Mic className="mr-1 h-3.5 w-3.5" />
              {isRequesting ? 'Connecting...' : 'Listen'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function NoteDetector() {
  const detection = useNoteDetection();
  return <NoteDetectorUI detection={detection} />;
}

export { NoteDetectorUI };
