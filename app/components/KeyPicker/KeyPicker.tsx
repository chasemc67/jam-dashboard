import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

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
import { Scale, ScaleType, Key, Note } from 'tonal';

interface KeyPickerProps {
  // optionally accept props such as defaultScale, styling, callbacks, etc.
}

const generate_key_options = () => {
  const all_notes = Note.names();
  // for every note, we need to return 2 entries and append the result into one big array
  const key_options: { label: string; value: string }[] = [];
  all_notes.forEach(note => {
    const major_scale = Key.majorKey(note).scale;
    const minor_scale = Key.minorKey(note).natural.scale;
    key_options.push({
      label: `${note} major (${major_scale.join(', ')})`,
      value: `${note} major`,
    });
    key_options.push({
      label: `${note} minor (${minor_scale.join(', ')})`,
      value: `${note} minor`,
    });
  });
  return key_options;
};

const key_options = generate_key_options();

export const KeyPicker: React.FC<KeyPickerProps> = () => {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');

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
        <Command>
          <CommandInput placeholder="Search by notes or key name..." />
          <CommandList>
            <CommandEmpty>No key found.</CommandEmpty>
            <CommandGroup>
              {key_options.map(key_option => (
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
