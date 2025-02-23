import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import ScaleChordGrid from './ScaleChordGrid';

// Mock the context
jest.mock('~/contexts/ScaleKeyContext', () => ({
  useScaleKey: jest.fn(),
}));

describe('ScaleChordGrid', () => {
  const mockUseScaleKey = useScaleKey as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders C# major scale with correct chords', () => {
    // Mock the context for C# major
    mockUseScaleKey.mockReturnValue({
      keyScale: 'C# major',
    });

    render(
      <ScaleChordGrid
        enabledChordTypes={['maj', 'min', '7', 'maj7', 'min7', 'dim']}
        showNoteRow={true}
      />,
    );

    // Check root notes are rendered
    expect(screen.getByText('C#')).toBeInTheDocument();
    expect(screen.getByText('D#')).toBeInTheDocument();
    expect(screen.getByText('E#')).toBeInTheDocument();
    expect(screen.getByText('F#')).toBeInTheDocument();
    expect(screen.getByText('G#')).toBeInTheDocument();
    expect(screen.getByText('A#')).toBeInTheDocument();
    expect(screen.getByText('B#')).toBeInTheDocument();

    // Check some specific chord buttons
    // Major chords
    const c_sharp_maj = screen.getByText('C#maj');
    expect(c_sharp_maj).toBeInTheDocument();
    expect(c_sharp_maj).not.toBeDisabled();

    // Minor chords
    const d_sharp_min = screen.getByText('D#min');
    expect(d_sharp_min).toBeInTheDocument();
    expect(d_sharp_min).not.toBeDisabled();

    // Diminished chords
    const b_sharp_dim = screen.getByText('B#dim');
    expect(b_sharp_dim).toBeInTheDocument();
    expect(b_sharp_dim).not.toBeDisabled();

    // Check that some chords that shouldn't be in the scale are disabled
    const c_sharp_min = screen.getByText('C#min');
    expect(c_sharp_min).toBeDisabled();
  });

  test('renders C minor scale with correct chords', () => {
    // Mock the context for C minor
    mockUseScaleKey.mockReturnValue({
      keyScale: 'C minor',
    });

    render(
      <ScaleChordGrid
        enabledChordTypes={['maj', 'min', '7', 'maj7', 'min7', 'dim']}
        showNoteRow={true}
      />,
    );

    // Check root notes are rendered
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('Eb')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('Ab')).toBeInTheDocument();
    expect(screen.getByText('Bb')).toBeInTheDocument();

    // Check some specific chord buttons
    // Minor chords (tonic should be minor)
    const c_min = screen.getByText('Cmin');
    expect(c_min).toBeInTheDocument();
    expect(c_min).not.toBeDisabled();

    // Major chords (relative major - Eb)
    const eb_maj = screen.getByText('Ebmaj');
    expect(eb_maj).toBeInTheDocument();
    expect(eb_maj).not.toBeDisabled();

    // Diminished chords
    const d_dim = screen.getByText('Ddim');
    expect(d_dim).toBeInTheDocument();
    expect(d_dim).not.toBeDisabled();

    // Check that some chords that shouldn't be in the scale are disabled
    const c_maj = screen.getByText('Cmaj');
    expect(c_maj).toBeDisabled();
  });

  test('respects showNoteRow prop', () => {
    mockUseScaleKey.mockReturnValue({
      keyScale: 'C major',
    });

    const { rerender } = render(
      <ScaleChordGrid enabledChordTypes={['maj', 'min']} showNoteRow={false} />,
    );

    // Note row should not be visible
    expect(screen.queryByText('C')).not.toBeInTheDocument();

    // Rerender with showNoteRow true
    rerender(
      <ScaleChordGrid enabledChordTypes={['maj', 'min']} showNoteRow={true} />,
    );

    // Note row should now be visible
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  test('respects disabled prop', () => {
    mockUseScaleKey.mockReturnValue({
      keyScale: 'C major',
    });

    render(
      <ScaleChordGrid
        enabledChordTypes={['maj', 'min']}
        showNoteRow={true}
        disabled={true}
      />,
    );

    // All buttons should be disabled
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });
});
