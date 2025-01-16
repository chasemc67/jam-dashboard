import React, { useState, useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import type { PolySynth, Synth } from 'tone';

export interface PlayerProps {
  notes: string[];
  className?: string;
}

const Player: React.FC<PlayerProps> = ({ notes, className }) => {
  const [chord, setChord] = useState<string[]>(notes);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const synthRef = useRef<PolySynth<Synth> | null>(null);

  useEffect(() => {
    setChord(notes);
  }, [notes]);

  const initializeAudio = async () => {
    const Tone = await import('tone');
    await Tone.start();
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    }
    setIsAudioInitialized(true);
    return Tone;
  };

  const playChordArpeggio = async () => {
    const Tone = !isAudioInitialized
      ? await initializeAudio()
      : await import('tone');
    const now = Tone.now();
    if (synthRef.current) {
      chord.forEach((note, i) => {
        synthRef.current?.triggerAttackRelease(note, '2n', now + 0.1 * i);
      });
    }
  };

  const playChordSimultaneous = async () => {
    const Tone = !isAudioInitialized
      ? await initializeAudio()
      : await import('tone');
    const now = Tone.now();
    if (synthRef.current) {
      synthRef.current.triggerAttackRelease(chord, '2n', now);
    }
  };

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Button variant="outline" onClick={playChordSimultaneous}>
          Play
        </Button>
        <Button variant="outline" onClick={playChordArpeggio}>
          Play Arpeggiated
        </Button>
      </div>
    </div>
  );
};

export default Player;
