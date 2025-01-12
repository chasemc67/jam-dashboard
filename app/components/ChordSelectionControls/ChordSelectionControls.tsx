import React from 'react';
import Select from 'react-select';
import {
  ChordTypeGroup,
  chordTypeGroups,
  possibleKeys,
} from '../../utils/chordPlayerUtils';

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
  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <label>
          Key:
          <select
            value={selectedKey}
            onChange={e => onKeyChange(e.target.value)}
            style={{ marginLeft: '10px' }}
          >
            {possibleKeys.map(key => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div>Chord Types:</div>
        <div style={{ width: '300px' }}>
          <Select
            isMulti
            closeMenuOnSelect={false}
            name="chord-types"
            options={chordTypeGroups}
            value={selectedChordGroups}
            onChange={onChordGroupsChange}
            className="basic-multi-select"
            classNamePrefix="select"
          />
        </div>
      </div>
    </div>
  );
};

export default ChordSelectionControls;
