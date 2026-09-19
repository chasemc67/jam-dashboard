// FretboardControls.tsx

import React, { useEffect } from 'react';
import FretBoard from '../FretBoard';
import { getNoteColorClass, getSplitBorderClasses } from '~/utils/noteColors';
import { useSettings } from '~/contexts/SettingsContext';
import { getCagedNoteColors, orientCagedColors } from '~/utils/cagedColorUtils';
import { useHighlight } from '~/contexts/HighlightContext';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import { useAgent } from '~/contexts/AgentContext';
import VoicingControls from '../VoicingControls';
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

const FretboardControls: React.FC = () => {
  const { getHighlightedNotes } = useHighlight();
  const { notes, pentatonicNotes } = useScaleKey();
  const { settings } = useSettings();
  const { rootNotes, setRootNotes, display, setViewReady } = useAgent();
  useEffect(() => {
    setViewReady(true);
    return () => setViewReady(false);
  }, [setViewReady]);
  const startingFret = 0;

  const shouldShowWarning =
    pentatonicNotes.length === 0 &&
    ((settings.quickColors !== 'scale' &&
      settings.quickColors !== 'major/minor roots') ||
      settings.cagedModeEnabled);

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
    if (
      display.positions &&
      !display.positions.some(p => p.string === stringIndex + 1 && p.fret === 0)
    )
      return 'border-black';
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
        className="flex items-center gap-1 h-[30px]"
        style={
          { '--num-strings': settings.numberOfStrings } as React.CSSProperties
        }
      >
        <input
          maxLength={6}
          aria-label={`String ${index + 1} tuning`}
          value={note}
          onChange={e => handleInputChange(index, e.target.value)}
          className={`w-[30px] h-[30px] text-center border-[5px] bg-background [color-scheme:dark] ${getOutlineColor(note, index)}`}
        />
        {display.positions && (
          <span
            className="w-4 text-xs"
            aria-label={`String ${index + 1} ${display.positions.some(p => p.string === index + 1) ? 'played' : 'muted'}`}
          >
            {!display.positions.some(p => p.string === index + 1)
              ? '×'
              : display.positions.some(
                    p => p.string === index + 1 && p.fret === 0,
                  )
                ? '○'
                : ''}
          </span>
        )}
      </div>
    ));
  };

  return (
    <div>
      <VoicingControls />
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
          className={`flex flex-col justify-between h-[310px] -mt-[5px] ${settings.isLefty ? 'order-1' : 'order-0'}`}
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
                positions={display.positions}
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
