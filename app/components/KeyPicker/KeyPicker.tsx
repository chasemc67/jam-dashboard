import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

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
import { Key, Note } from 'tonal';

// Add noop filter function that always returns 1 (highest score)
// This effectively disables the built-in filtering
const noopFilter = () => 1;

interface KeyPickerProps {
  // optionally accept props such as defaultScale, styling, callbacks, etc.
}

interface KeyOption {
  label: string;
  value: string;
  scale: string[];
}

export const generate_key_options = () => {
  const key_options: KeyOption[] = [];
  all_notes.forEach(note => {
    const major_scale = [...Key.majorKey(note).scale];
    const minor_scale = [...Key.minorKey(note).natural.scale];
    key_options.push({
      label: `${note} major (${major_scale.join(', ')})`,
      value: `${note} major`,
      scale: major_scale,
    });
    key_options.push({
      label: `${note} minor (${minor_scale.join(', ')})`,
      value: `${note} minor`,
      scale: minor_scale,
    });
  });
  return key_options;
};

export const parseSearchInput = (input: string): string[] => {
  // parse search input into an array of notes
  return input
    .split(',')
    .map(note => note.trim())
    .filter(note => note.length > 0);
};

const key_options = generate_key_options();

export const KeyPicker: React.FC<KeyPickerProps> = () => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const filteredOptions = useMemo(() => {
    const searchNotes = parseSearchInput(searchInput);

    if (searchNotes.length === 0) {
      return key_options;
    }

    // Return options where all search notes are found in the scale
    const filtered_options = key_options.filter(option =>
      searchNotes.every(searchNote =>
        option.scale.some(
          scaleNote => Note.simplify(scaleNote) === Note.simplify(searchNote),
        ),
      ),
    );
    console.log(filtered_options);
    return filtered_options;
  }, [searchInput]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
        >
          {value
            ? key_options.find(key_option => key_option.value === value)?.label
            : 'Select key...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command filter={noopFilter}>
          <CommandInput
            placeholder="Enter notes separated by commas..."
            value={searchInput}
            onValueChange={setSearchInput}
          />
          <CommandList>
            <CommandEmpty>No matching keys found.</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map(key_option => (
                <CommandItem
                  key={key_option.value}
                  value={key_option.value}
                  onSelect={currentValue => {
                    setValue(currentValue === value ? '' : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === key_option.value ? 'opacity-100' : 'opacity-0',
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
