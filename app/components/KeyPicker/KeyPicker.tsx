import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Note, Scale } from 'tonal';
import { all_notes } from '~/utils/musicTheoryUtils';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import { useSettings } from '~/contexts/SettingsContext';
import { filteredScaleTypes } from '~/utils/scaleTypes';

interface KeyOption {
  label: string;
  value: string;
  scale: string[];
}

export const generate_key_options = (scaleTypes: string[]) => {
  const key_options: KeyOption[] = [];
  all_notes.forEach(note => {
    scaleTypes.forEach(scaleType => {
      const scale = Scale.get(`${note} ${scaleType}`).notes;
      key_options.push({
        label: `${note} ${scaleType} (${scale.join(', ')})`,
        value: `${note} ${scaleType}`,
        scale: scale,
      });
    });
  });
  return key_options;
};

export const parseSearchInput = (input: string): string[] => {
  return input
    .split(',')
    .map(note => note.trim())
    .filter(note => note.length > 0);
};

export const KeyPicker: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { keyScale, setKeyScale } = useScaleKey();
  const { settings } = useSettings();

  const key_options = useMemo(() => {
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

    return generate_key_options(enabledScaleTypes);
  }, [
    settings.showMajorMinorScales,
    settings.showHarmonicMelodicScales,
    settings.showModes,
  ]);

  const filterKeys = (value: string, search: string) => {
    const option = key_options.find(opt => opt.value === value);
    if (!option) return 0;

    if (!search.includes(',')) {
      return option.value.toLowerCase().startsWith(search.toLowerCase())
        ? 1
        : 0;
    }

    const searchNotes = parseSearchInput(search);
    if (searchNotes.length === 0) {
      return 1;
    }

    const matchesAllNotes = searchNotes.every(searchNote =>
      option.scale.some(
        scaleNote => Note.simplify(scaleNote) === Note.simplify(searchNote),
      ),
    );

    return matchesAllNotes ? 1 : 0;
  };

  const handleKeySelect = (currentValue: string) => {
    const newValue = currentValue === keyScale ? '' : currentValue;
    setOpen(false);
    setKeyScale(newValue);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[350px] justify-between"
        >
          {keyScale
            ? key_options.find(key_option => key_option.value === keyScale)
                ?.label
            : 'Select key...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0">
        <Command filter={filterKeys}>
          <CommandInput placeholder="Detect key: enter notes separated by commas..." />
          <CommandList>
            <CommandEmpty>No matching keys found.</CommandEmpty>
            <CommandGroup>
              {key_options.map(key_option => (
                <CommandItem
                  key={key_option.value}
                  value={key_option.value}
                  onSelect={handleKeySelect}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      keyScale === key_option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  {key_option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
