import React, { useEffect, useState } from 'react';
import Select, { StylesConfig } from 'react-select';
import { ChordTypeGroup, chordTypeGroups } from '../../utils/chordPlayerUtils';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';

export type ChordSelectionControlsProps = {
  selectedChordGroups: ChordTypeGroup[];
  onChordGroupsChange: (groups: readonly ChordTypeGroup[]) => void;
};

const ChordSelectionControls: React.FC<ChordSelectionControlsProps> = ({
  selectedChordGroups,
  onChordGroupsChange,
}) => {
  const { selectedKey } = useHighlightedNotes();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    //force client-side rendering because we get some weird issues sometimes due to SSR of react-select
    setIsMounted(true);
  }, []);

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
        {!selectedKey && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">
              {selectedKey || 'Select a Key at the top of the page'}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-[90%]">
          {isMounted ? (
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
              instanceId="chord-types-select"
            />
          ) : (
            <div className="h-[38px] w-full bg-muted rounded-md" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChordSelectionControls;
