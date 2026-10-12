// Which note (if any) to draw on each string/fret, and in which colors. Shared by
// the fretboard diagram and the live camera overlay so both show the same notes.
import { getNoteAtFret, areNotesEquivalent } from '~/utils/musicTheoryUtils';
import { getCagedNoteColors } from '~/utils/cagedColorUtils';
import type { CAGEDShapeSelection } from '~/utils/cagedShapeUtils';
import type { Position } from '../../shared/music/voicings';

export const INTERVALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export type HighlightedNote = {
  note: string;
  color: string;
};

export type FretNoteMarkerOptions = {
  notes: string[];
  pentatonicNotes: string[];
  highlightedNotes: HighlightedNote[];
  cagedModeEnabled: boolean;
  cagedShape: CAGEDShapeSelection;
  showTextNotes?: boolean;
  /** When supplied, show only these exact locations instead of pitch-class highlights. */
  positions?: Position[];
};

export type FretNoteMarker = {
  /** 1-based string number (1 = the first tuning entry, normally high E). */
  string: number;
  fret: number;
  note: string;
  label: string;
  /** One color, or two ordered nut side first (CAGED notes shared by two shapes). */
  colors: [string] | [string, string];
  caged: boolean;
};

export const usesCagedColors = (options: FretNoteMarkerOptions) =>
  options.positions === undefined &&
  options.cagedModeEnabled &&
  options.pentatonicNotes.length !== 0;

const intervalLabel = (notes: string[], note: string) =>
  INTERVALS[notes.findIndex(n => areNotesEquivalent(n, note))];

export function getFretNoteMarker(
  options: FretNoteMarkerOptions,
  rootNote: string,
  stringIndex: number,
  fretNumber: number,
): FretNoteMarker | null {
  const stringNumber = stringIndex + 1;
  const currentNote = getNoteAtFret(rootNote, fretNumber);
  if (usesCagedColors(options)) {
    const colors = getCagedNoteColors(
      currentNote,
      stringNumber,
      options.cagedShape,
      options.notes,
      options.pentatonicNotes,
    );
    if (!colors) return null;
    return {
      string: stringNumber,
      fret: fretNumber,
      note: currentNote,
      label: options.showTextNotes
        ? currentNote
        : intervalLabel(options.notes, currentNote),
      colors,
      caged: true,
    };
  }
  const highlighted = options.highlightedNotes.find(hn =>
    areNotesEquivalent(hn.note, currentNote),
  );
  if (
    !highlighted ||
    (options.positions !== undefined &&
      !options.positions.some(
        p => p.string === stringNumber && p.fret === fretNumber,
      ))
  )
    return null;
  return {
    string: stringNumber,
    fret: fretNumber,
    note: highlighted.note,
    label: options.showTextNotes
      ? highlighted.note
      : intervalLabel(options.notes, highlighted.note),
    colors: [highlighted.color],
    caged: false,
  };
}

/** Markers for every string on frets `fromFret..toFret` (inclusive). */
export function getFretboardNoteMarkers(
  options: FretNoteMarkerOptions,
  rootNotes: string[],
  fromFret: number,
  toFret: number,
): FretNoteMarker[] {
  const markers: FretNoteMarker[] = [];
  for (let fret = fromFret; fret <= toFret; fret++)
    rootNotes.forEach((rootNote, stringIndex) => {
      const marker = getFretNoteMarker(options, rootNote, stringIndex, fret);
      if (marker) markers.push(marker);
    });
  return markers;
}
