import type { PolySynth, Synth } from 'tone';

let synth: PolySynth<Synth> | null = null;
let hasUnblocked = false;
let silentAudio: HTMLAudioElement | null = null;
let cleanupTimeout: NodeJS.Timeout | null = null;

const CLEANUP_DELAY = 5000; // 5 seconds after last audio play

const cleanupAudio = () => {
  if (silentAudio) {
    silentAudio.pause();
    silentAudio.src = '';
    silentAudio.remove();
    silentAudio = null;
    hasUnblocked = false;
  }
};

const debouncedCleanup = () => {
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout);
  }
  cleanupTimeout = setTimeout(cleanupAudio, CLEANUP_DELAY);
};

const unblockAudio = () => {
  if (hasUnblocked) return;

  // Create and play silent audio to unblock iOS audio
  silentAudio = new Audio('/assets/silent.mp3');
  silentAudio.setAttribute('x-webkit-airplay', 'deny');
  silentAudio.setAttribute('preload', 'auto');
  silentAudio.loop = true;
  silentAudio.play().catch(console.error);

  hasUnblocked = true;
};

export const initializeAudio = async () => {
  const Tone = await import('tone');

  // Always try to unblock audio first
  unblockAudio();

  await Tone.start();
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 1,
      },
      volume: -6,
    }).toDestination();

    const reverb = new Tone.Reverb({
      decay: 1.5,
      wet: 0.2,
    }).toDestination();

    synth.connect(reverb);
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
  debouncedCleanup();
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
  debouncedCleanup();
};
