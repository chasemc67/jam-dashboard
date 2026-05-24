import { useState } from 'react';
import { Mic, MicOff, Shield, Trash2 } from 'lucide-react';
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

function NoteChip({ note }: { note: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-sm font-medium text-secondary-foreground">
      {note}
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
  } = detection;

  const [showUnique, setShowUnique] = useState(false);
  const isListening = status === 'listening';
  const isRequesting = status === 'requesting';

  const uniqueNotes = Array.from(new Set(noteLog));
  const displayedNotes = showUnique ? uniqueNotes : noteLog;

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Permission gate or device picker + controls */}
      {!hasPermission ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6">
          <Shield className="h-8 w-8 text-muted-foreground" />
          <p className="text-center text-sm text-muted-foreground">
            Grant microphone access so we can detect your audio input devices.
          </p>
          <Button onClick={requestPermission}>
            <Mic className="mr-1 h-4 w-4" />
            Allow Microphone Access
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={selectedDeviceId ?? undefined}
            onValueChange={(v) => setSelectedDeviceId(v || null)}
            disabled={isListening}
          >
            <SelectTrigger className="w-full sm:w-64">
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

          <div className="flex gap-2">
            {isListening ? (
              <Button variant="destructive" onClick={stop}>
                <MicOff className="mr-1 h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={start} disabled={isRequesting}>
                <Mic className="mr-1 h-4 w-4" />
                {isRequesting ? 'Connecting...' : 'Start Listening'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Current note — big display */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-8">
        <span className="mb-2 text-sm text-muted-foreground">
          {isListening ? 'Current Note' : 'Play a note to begin'}
        </span>
        <span className="text-7xl font-bold text-primary tabular-nums">
          {currentNote ?? '--'}
        </span>
      </div>

      {/* Note log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            Detected Notes
          </h3>
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

        <div className="min-h-[3rem] rounded-lg border border-border bg-card p-3">
          {displayedNotes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {displayedNotes.map((note, i) => (
                <NoteChip key={`${note}-${i}`} note={note} />
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
    </div>
  );
}

export default function NoteDetector() {
  const detection = useNoteDetection();
  return <NoteDetectorUI detection={detection} />;
}

export { NoteDetectorUI };
