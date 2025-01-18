import React from 'react';
import { Button } from '~/components/ui/button';
import { playChordSimultaneous, playChordArpeggio } from '~/utils/audioUtils';

export interface PlayerProps {
  notes: string[];
  className?: string;
}

const Player: React.FC<PlayerProps> = ({ notes, className }) => {
  return (
    <div className={className}>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => playChordSimultaneous(notes)}>
          Play
        </Button>
        <Button variant="outline" onClick={() => playChordArpeggio(notes)}>
          Play Arpeggiated
        </Button>
      </div>
    </div>
  );
};

export default Player;
