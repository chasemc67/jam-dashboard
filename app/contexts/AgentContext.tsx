import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { useSettings } from './SettingsContext';
import { useScaleKey } from './ScaleKeyContext';
import { useHighlight } from './HighlightContext';
import { getTuningForStrings, TUNING_PRESETS } from '~/utils/tuningPresets';
import type {
  AppController,
  AppState,
  Display,
} from '../../shared/agent/contract';
import { prepareCommand } from '../../shared/agent/commands';

const useCommitEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect;
function binding(
  state: Pick<AppState, 'scale' | 'tuning' | 'highlightNotes' | 'settings'>,
  highlightRevision: number,
) {
  return JSON.stringify([
    state.scale,
    state.tuning,
    state.highlightNotes,
    state.settings.cagedModeEnabled,
    state.settings.numberOfFrets,
    highlightRevision,
  ]);
}
type AgentContextValue = {
  controller: AppController;
  rootNotes: string[];
  setRootNotes: (notes: string[]) => void;
  display: Display;
  setViewReady: (ready: boolean) => void;
};
const AgentContext = createContext<AgentContextValue | undefined>(undefined);

/** A facade over the existing contexts; transport code never writes React state directly. */
export function AgentProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const { keyScale, notes, setKeyScale } = useScaleKey();
  const { chordHighlightNotes, setChordHighlight, highlightRevision } =
    useHighlight();
  const [tuning, setRootNotes] = useState(TUNING_PRESETS[0].notes);
  const rootNotes = useMemo(
    () =>
      getTuningForStrings(
        { name: 'Current', notes: tuning },
        settings.numberOfStrings,
      ),
    [tuning, settings.numberOfStrings],
  );
  const [viewReady, setViewReady] = useState(false);
  const [selection, setSelection] = useState<{
    binding: string;
    display: Display;
  } | null>(null);
  const listeners = useRef(new Set<(state: AppState) => void>());
  const data = {
    protocolVersion: 1 as const,
    viewReady,
    scale: notes.length ? keyScale : null,
    scaleNotes: notes,
    tuning: rootNotes,
    settings: {
      numberOfFrets: settings.numberOfFrets,
      isLefty: settings.isLefty,
      showTextNotes: settings.showTextNotes,
      quickColors: settings.quickColors,
      cagedModeEnabled: settings.cagedModeEnabled,
      cagedShape: settings.cagedShape,
    },
    highlightNotes: chordHighlightNotes,
  };
  const currentBinding = binding(data, highlightRevision);
  const display: Display =
    selection?.binding === currentBinding
      ? selection.display
      : { kind: chordHighlightNotes.length ? 'notes' : 'scale' };
  const state = { ...data, display };
  const committed = useRef<AppState>({ ...state, revision: 0 });
  const serialized = JSON.stringify(state);
  const previous = useRef('');
  useCommitEffect(() => {
    // A manual edit invalidates the old selection permanently, even if the user later returns to the same scale/tuning.
    if (selection && selection.binding !== currentBinding) setSelection(null);
    if (previous.current === serialized) return;
    previous.current = serialized;
    committed.current = { ...state, revision: committed.current.revision + 1 };
    for (const listener of listeners.current) listener(committed.current);
  });

  const apply = useRef<AppController['execute']>(async () => committed.current);
  apply.current = async (command, expectedRevision) => {
    const next = prepareCommand(committed.current, command, expectedRevision);
    flushSync(() => {
      if (next.scale !== committed.current.scale) setKeyScale(next.scale ?? '');
      setChordHighlight(next.highlightNotes, next.scale ?? '');
      updateSettings({ ...next.settings, numberOfStrings: next.tuning.length });
      setRootNotes(next.tuning);
      setSelection({
        binding: binding(next, highlightRevision + 1),
        display: next.display,
      });
    });
    // The commit effect has now observed the exact state used to render the DOM.
    return committed.current;
  };
  const controller = useMemo<AppController>(
    () => ({
      read: () => committed.current,
      subscribe: listener => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
      execute: (command, revision) => apply.current(command, revision),
    }),
    [],
  );

  return (
    <AgentContext.Provider
      value={{ controller, rootNotes, setRootNotes, display, setViewReady }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const value = useContext(AgentContext);
  if (!value) throw new Error('useAgent must be used within AgentProvider');
  return value;
}
