import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Key, Note } from 'tonal';
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
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';

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
  return input
    .split(',')
    .map(note => note.trim())
    .filter(note => note.length > 0);
};

const key_options = generate_key_options();

export const KeyPicker: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { selectedKey, setKeyAndNotes } = useHighlightedNotes();

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
    const newKey = currentValue === selectedKey ? '' : currentValue;
    setOpen(false);

    // Update both key and notes through context
    const selectedKeyOption = key_options.find(
      opt => opt.value === currentValue,
    );
    if (selectedKeyOption) {
      setKeyAndNotes(newKey, selectedKeyOption.scale);
    } else if (newKey === '') {
      setKeyAndNotes('', []);
    }
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
          {selectedKey
            ? key_options.find(key_option => key_option.value === selectedKey)
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
                      selectedKey === key_option.value
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
