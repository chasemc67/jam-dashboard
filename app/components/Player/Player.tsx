import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Button } from '~/components/ui/button';

export interface PlayerProps {
  notes: string[];
}

const Player: React.FC<PlayerProps> = ({ notes }) => {
  const [chord, setChord] = useState<string[]>(notes);
  const synthRef = useRef<Tone.PolySynth | null>(null);

  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    }
  }, []);

  useEffect(() => {
    setChord(notes);
  }, [notes]);

  const playChordArpeggio = async () => {
    await Tone.start();
    const now = Tone.now();
    if (synthRef.current) {
      chord.forEach((note, i) => {
        synthRef.current?.triggerAttackRelease(note, '2n', now + 0.1 * i);
      });
    }
  };

  const playChordSimultaneous = async () => {
    await Tone.start();
    const now = Tone.now();
    if (synthRef.current) {
      synthRef.current.triggerAttackRelease(chord, '2n', now);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={playChordArpeggio}>
        Play Arpeggio
      </Button>
      <Button onClick={playChordSimultaneous}>Play Chord</Button>
    </div>
  );
};

export default Player;
