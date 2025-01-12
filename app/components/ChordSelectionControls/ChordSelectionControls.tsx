import React from 'react';
import Select, { StylesConfig } from 'react-select';
import {
  ChordTypeGroup,
  chordTypeGroups,
  possibleKeys,
} from '../../utils/chordPlayerUtils';
import { cn } from '~/lib/utils';

export type ChordSelectionControlsProps = {
  selectedKey: string;
  onKeyChange: (key: string) => void;
  selectedChordGroups: ChordTypeGroup[];
  onChordGroupsChange: (groups: readonly ChordTypeGroup[]) => void;
};

const ChordSelectionControls: React.FC<ChordSelectionControlsProps> = ({
  selectedKey,
  onKeyChange,
  selectedChordGroups,
  onChordGroupsChange,
}) => {
  const selectStyles: StylesConfig<ChordTypeGroup, true> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      borderRadius: 'calc(var(--radius) - 2px)',
      boxShadow: state.isFocused ? '0 0 0 2px hsl(var(--ring))' : 'none',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    menu: base => ({
      ...base,
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'var(--radius)',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'hsl(var(--primary))'
        : state.isFocused
          ? 'hsl(var(--accent))'
          : 'transparent',
      color: state.isSelected
        ? 'hsl(var(--primary-foreground))'
        : 'hsl(var(--popover-foreground))',
      '&:active': {
        backgroundColor: 'hsl(var(--accent))',
      },
    }),
    multiValue: base => ({
      ...base,
      backgroundColor: 'hsl(var(--secondary))',
      borderRadius: 'calc(var(--radius) - 4px)',
    }),
    multiValueLabel: base => ({
      ...base,
      color: 'hsl(var(--secondary-foreground))',
    }),
    multiValueRemove: base => ({
      ...base,
      color: 'hsl(var(--secondary-foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--destructive))',
        color: 'hsl(var(--destructive-foreground))',
      },
    }),
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Key:</span>
          <select
            value={selectedKey}
            onChange={e => onKeyChange(e.target.value)}
            className={cn(
              'h-9 rounded-md border border-input bg-background px-3',
              'text-sm ring-offset-background',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {possibleKeys.map(key => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-foreground">
          Chord Types:
        </div>
        <div className="w-[300px]">
          <Select
            isMulti
            closeMenuOnSelect={false}
            name="chord-types"
            options={chordTypeGroups}
            value={selectedChordGroups}
            onChange={onChordGroupsChange}
            styles={selectStyles}
            className="text-sm"
            classNamePrefix="select"
          />
        </div>
      </div>
    </div>
  );
};

export default ChordSelectionControls;
