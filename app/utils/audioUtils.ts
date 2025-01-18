import type { PolySynth, Synth } from 'tone';

let synth: PolySynth<Synth> | null = null;

export const initializeAudio = async () => {
  const Tone = await import('tone');
  await Tone.start();
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth).toDestination();
  }
  return Tone;
};

export const playChordSimultaneous = async (notes: string[]) => {
  const Tone = await import('tone');
  if (!synth) {
    await initializeAudio();
  }
  const now = Tone.now();
  const duration = 1; // 1 second duration
  synth?.triggerAttackRelease(notes, duration, now);
};

export const playChordArpeggio = async (notes: string[]) => {
  const Tone = await import('tone');
  if (!synth) {
    await initializeAudio();
  }
  const now = Tone.now();
  const noteDuration = 0.5; // 0.5 seconds per note
  notes.forEach((note, i) => {
    synth?.triggerAttackRelease(note, noteDuration, now + 0.25 * i);
  });
};
