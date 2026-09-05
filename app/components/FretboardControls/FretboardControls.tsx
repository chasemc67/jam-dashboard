// FretboardControls.tsx

import React, { useState, useEffect } from 'react';
import FretBoard from '../FretBoard';
import { getNoteColorClass, getSplitBorderClasses } from '~/utils/noteColors';
import { useSettings } from '~/contexts/SettingsContext';
import { getCagedNoteColors, orientCagedColors } from '~/utils/cagedColorUtils';
import { useHighlight } from '~/contexts/HighlightContext';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import { areNotesEquivalent } from '~/utils/musicTheoryUtils';
import {
  CUSTOM_TUNING_NAME,
  TUNING_PRESETS,
  findMatchingPreset,
  getTuningForStrings,
} from '~/utils/tuningPresets';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

const DEFAULT_TUNING_PATTERN = ['E', 'B', 'G', 'D', 'A'];

const getDefaultTuning = (numberOfStrings: number): string[] => {
  const tuning: string[] = [];
  for (let i = 0; i < numberOfStrings; i++) {
    tuning.push(DEFAULT_TUNING_PATTERN[i % DEFAULT_TUNING_PATTERN.length]);
  }
  return tuning;
};

const FretboardControls: React.FC = () => {
  const { getHighlightedNotes } = useHighlight();
  const { notes, pentatonicNotes } = useScaleKey();
  const { settings } = useSettings();
  const [rootNotes, setRootNotes] = useState(() =>
    getDefaultTuning(settings.numberOfStrings),
  );
  const [startingFret] = useState(0);

  const shouldShowWarning =
    pentatonicNotes.length === 0 &&
    ((settings.quickColors !== 'scale' &&
      settings.quickColors !== 'major/minor roots') ||
      settings.cagedModeEnabled);

  // Update tuning when number of strings changes
  useEffect(() => {
    setRootNotes(prev => {
      const newTuning = getDefaultTuning(settings.numberOfStrings);
      // Preserve existing tuning values for strings that still exist
      for (
        let i = 0;
        i < Math.min(prev.length, settings.numberOfStrings);
        i++
      ) {
        newTuning[i] = prev[i];
      }
      return newTuning;
    });
  }, [settings.numberOfStrings]);

  const matchingPreset = findMatchingPreset(rootNotes);

  const handlePresetChange = (presetName: string) => {
    const preset = TUNING_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setRootNotes(getTuningForStrings(preset, settings.numberOfStrings));
    }
  };

  const handleInputChange = (index: number, value: string) => {
    const processedValue =
      value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    const updatedRootNotes = [...rootNotes];
    updatedRootNotes[index] = processedValue;
    setRootNotes(updatedRootNotes);
  };

  const getOutlineColor = (note: string, stringIndex: number) => {
    if (settings.cagedModeEnabled && pentatonicNotes.length !== 0) {
      const stringNumber = stringIndex + 1;
      const noteColors = getCagedNoteColors(
        note,
        stringNumber,
        settings.cagedShape,
        notes,
        pentatonicNotes,
      );
      return noteColors
        ? getSplitBorderClasses(orientCagedColors(noteColors, settings.isLefty))
        : 'border-black';
    }

    const foundNote = getHighlightedNotes().find(n =>
      areNotesEquivalent(n.note, note),
    );
    return foundNote
      ? getNoteColorClass(foundNote.color, 'border')
      : 'border-black';
  };

  const renderInputs = () => {
    return rootNotes.map((note, index) => (
      <div
        key={index}
        className="flex items-start h-[calc(100%/var(--num-strings))]"
        style={
          { '--num-strings': settings.numberOfStrings } as React.CSSProperties
        }
      >
        <input
          value={note}
          onChange={e => handleInputChange(index, e.target.value)}
          className={`w-[30px] h-[30px] text-center border-[5px] bg-background [color-scheme:dark] ${getOutlineColor(note, index)}`}
        />
      </div>
    ));
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 mb-2 ${settings.isLefty ? 'justify-end' : ''}`}
      >
        <Label htmlFor="tuning-preset">Tuning:</Label>
        <Select
          value={matchingPreset?.name ?? CUSTOM_TUNING_NAME}
          onValueChange={handlePresetChange}
        >
          <SelectTrigger
            id="tuning-preset"
            className="w-[140px] h-8"
            aria-label="Tuning preset"
          >
            <SelectValue placeholder="Select tuning" />
          </SelectTrigger>
          <SelectContent>
            {TUNING_PRESETS.map(preset => (
              <SelectItem key={preset.name} value={preset.name}>
                {preset.name}
              </SelectItem>
            ))}
            {!matchingPreset && (
              <SelectItem value={CUSTOM_TUNING_NAME} disabled>
                {CUSTOM_TUNING_NAME}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="flex">
        <div
          className={`flex flex-col justify-between h-[330px] ${settings.isLefty ? 'order-1' : 'order-0'}`}
        >
          {renderInputs()}
        </div>
        <div className={settings.isLefty ? 'order-0' : 'order-1'}>
          <div className="max-w-[90vw] overflow-x-auto md:max-w-none md:overflow-visible">
            <div className="inline-flex">
              <FretBoard
                rootNotes={rootNotes}
                numberOfFrets={settings.numberOfFrets}
                startingFret={startingFret}
                showTextNotes={settings.showTextNotes}
                isLeftHanded={settings.isLefty}
              />
            </div>
          </div>
        </div>
      </div>
      {shouldShowWarning && (
        <p className="text-feedback-incorrect mt-2 text-sm">
          The selected scale doesn&apos;t support{' '}
          {settings.cagedModeEnabled ? 'CAGED' : settings.quickColors} coloring,
          falling back to normal scale coloring
        </p>
      )}
    </div>
  );
};

export default FretboardControls;
