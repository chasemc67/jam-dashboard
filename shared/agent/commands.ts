import { Note } from 'tonal';
import { CommandSchema, type AppState, type Command } from './contract';
import {
  chroma,
  getChord,
  getScale,
  pitchClass,
  requireInScale,
  ToolError,
} from '../music/theory';
import { findVoicings, STANDARD_PITCH_CLASSES } from '../music/voicings';

/** Validate the entire command before any React state is changed. */
export function prepareCommand(
  current: AppState,
  raw: Command,
  expectedRevision?: number,
): AppState {
  if (!current.viewReady)
    throw new ToolError(
      'VIEW_NOT_READY',
      'Open the dashboard fretboard before changing its view.',
    );
  if (expectedRevision !== undefined && current.revision !== expectedRevision)
    throw new ToolError(
      'REVISION_CONFLICT',
      'The view changed. Call get_state and retry with the current revision.',
    );
  const command = CommandSchema.parse(raw);
  const next: AppState = { ...current, settings: { ...current.settings } };
  if ('scale' in command.input && command.input.scale) {
    const scale = getScale(command.input.scale);
    next.scale = scale.name;
    next.scaleNotes = scale.notes;
    next.highlightNotes = [];
    next.display = { kind: 'scale' };
  }
  if (!next.scale)
    throw new ToolError(
      'SCALE_REQUIRED',
      'Select a scale with set_view before visualizing notes.',
    );

  switch (command.type) {
    case 'set_view': {
      next.settings = { ...next.settings, ...command.input.settings };
      if (command.input.tuning) {
        next.tuning = command.input.tuning.map(pitchClass);
        next.display = { kind: next.highlightNotes.length ? 'notes' : 'scale' };
      }
      if (next.settings.cagedModeEnabled) {
        if (!getScale(next.scale).pentatonicNotes.length)
          throw new ToolError(
            'CAGED_UNAVAILABLE',
            'CAGED coloring requires a scale with an existing pentatonic mapping, such as major or minor.',
          );
        next.highlightNotes = [];
        next.display = { kind: 'scale' };
      }
      if (
        next.display.positions?.some(p => p.fret > next.settings.numberOfFrets)
      )
        throw new ToolError(
          'POSITION_OUT_OF_VIEW',
          'The fret range would hide selected positions. Clear the selection first with show_fretboard.',
        );
      break;
    }
    case 'show_fretboard': {
      const { chord, notes, positions } = command.input;
      const chordInfo = chord ? getChord(chord) : undefined;
      const positionNotes = positions?.map(p => {
        if (
          p.string > next.tuning.length ||
          p.fret > next.settings.numberOfFrets
        )
          throw new ToolError(
            'POSITION_OUT_OF_VIEW',
            'A position is outside the displayed strings or frets. Adjust set_view first.',
          );
        return Note.fromMidi(60 + chroma(next.tuning[p.string - 1]) + p.fret);
      });
      next.highlightNotes = requireInScale(
        chordInfo?.notes ?? notes ?? positionNotes ?? [],
        next.scale,
      );
      next.settings.cagedModeEnabled = false;
      next.display = {
        kind: positions
          ? 'positions'
          : next.highlightNotes.length
            ? 'notes'
            : 'scale',
        ...(chordInfo && { chord: chordInfo.symbol }),
        ...(positions && { positions }),
      };
      break;
    }
    case 'show_voicings': {
      if (
        next.tuning.length !== 6 ||
        next.tuning.some(
          (n, i) => chroma(n) !== chroma(STANDARD_PITCH_CLASSES[i]),
        )
      )
        throw new ToolError(
          'UNSUPPORTED_TUNING',
          'V1 voicings require six-string E standard tuning. Set tuning to [E, B, G, D, A, E] explicitly.',
        );
      next.highlightNotes = requireInScale(
        getChord(command.input.chord).notes,
        next.scale,
      );
      const result = findVoicings(command.input.chord, command.input.options);
      if (!result.voicings.length)
        throw new ToolError(
          result.truncated ? 'SEARCH_LIMIT' : 'NO_VOICINGS',
          result.truncated
            ? 'The bounded search found no voicings before its work limit. Try a smaller fret range or simpler chord. The view was not changed.'
            : 'No voicings found within these constraints. The view was not changed.',
        );
      next.settings.cagedModeEnabled = false;
      next.settings.numberOfFrets = Math.max(
        current.settings.numberOfFrets,
        result.options.maxFret,
        1,
      );
      next.display = {
        kind: 'voicings',
        chord: result.chord.symbol,
        result,
        selectedIndex: 0,
        positions: result.voicings[0].positions,
      };
      break;
    }
    case 'select_voicing': {
      const { index } = command.input;
      const result = next.display.result;
      if (next.display.kind !== 'voicings' || !result?.voicings[index])
        throw new ToolError(
          'INVALID_VOICING_INDEX',
          'Run show_voicings first and select an index in its returned results.',
        );
      next.display = {
        ...next.display,
        selectedIndex: index,
        positions: result.voicings[index].positions,
      };
      break;
    }
  }
  next.tuning.forEach(pitchClass);
  return next;
}
