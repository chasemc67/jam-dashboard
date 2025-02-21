import { renderHook, act } from '@testing-library/react';
import { ScaleKeyProvider, useScaleKey } from './ScaleKeyContext';
import { Scale } from 'tonal';

// Helper function to wrap components with the provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ScaleKeyProvider>{children}</ScaleKeyProvider>
);

describe('ScaleKeyContext', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useScaleKey(), { wrapper });

    expect(result.current.key).toBe('C');
    expect(result.current.scale).toBe('major');
    expect(result.current.notes).toEqual(Scale.get('C major').notes);
    expect(result.current.pentatonicNotes).toEqual(
      Scale.get('C major pentatonic').notes,
    );
  });

  it('should update key correctly', () => {
    const { result } = renderHook(() => useScaleKey(), { wrapper });

    act(() => {
      result.current.setKey('D');
    });

    expect(result.current.key).toBe('D');
    expect(result.current.scale).toBe('major');
    expect(result.current.notes).toEqual(Scale.get('D major').notes);
    expect(result.current.pentatonicNotes).toEqual(
      Scale.get('D major pentatonic').notes,
    );
  });

  it('should update scale correctly', () => {
    const { result } = renderHook(() => useScaleKey(), { wrapper });

    act(() => {
      result.current.setScale('minor');
    });

    expect(result.current.key).toBe('C');
    expect(result.current.scale).toBe('minor');
    expect(result.current.notes).toEqual(Scale.get('C minor').notes);
    expect(result.current.pentatonicNotes).toEqual(
      Scale.get('C minor pentatonic').notes,
    );
  });

  it('should update both key and scale when using setKeyScale', () => {
    const { result } = renderHook(() => useScaleKey(), { wrapper });

    act(() => {
      result.current.setKeyScale('E', 'dorian');
    });

    expect(result.current.key).toBe('E');
    expect(result.current.scale).toBe('dorian');
    expect(result.current.notes).toEqual(Scale.get('E dorian').notes);
    expect(result.current.pentatonicNotes).toEqual([]); // dorian doesn't have a pentatonic
  });

  it('should handle scales without pentatonic versions', () => {
    const { result } = renderHook(() => useScaleKey(), { wrapper });

    act(() => {
      result.current.setKeyScale('F', 'locrian');
    });

    expect(result.current.key).toBe('F');
    expect(result.current.scale).toBe('locrian');
    expect(result.current.notes).toEqual(Scale.get('F locrian').notes);
    expect(result.current.pentatonicNotes).toEqual(
      Scale.get('F locrian pentatonic').notes,
    );
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useScaleKey());
    }).toThrow('useScaleKey must be used within a ScaleKeyProvider');
  });

  it('should handle chromatic notes in key', () => {
    const { result } = renderHook(() => useScaleKey(), { wrapper });

    act(() => {
      result.current.setKeyScale('F#', 'major');
    });

    expect(result.current.key).toBe('F#');
    expect(result.current.scale).toBe('major');
    expect(result.current.notes).toEqual(Scale.get('F# major').notes);
    expect(result.current.pentatonicNotes).toEqual(
      Scale.get('F# major pentatonic').notes,
    );
  });
});
