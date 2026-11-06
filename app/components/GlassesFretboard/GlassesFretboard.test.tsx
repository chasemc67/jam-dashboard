import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GlassesFretboard from './GlassesFretboard';

function Harness({ isLefty = false }: { isLefty?: boolean }) {
  const [fret, setFret] = useState(0);
  return (
    <GlassesFretboard
      musicKey="C"
      mode="major"
      shape="off"
      startingFret={fret}
      onStartingFretChange={setFret}
      isLefty={isLefty}
      focusOnMount
    />
  );
}

describe('GlassesFretboard', () => {
  it('focuses on mount and slides with Left/Right', () => {
    render(<Harness />);
    const board = screen.getByTestId('glasses-fretboard');
    expect(document.activeElement).toBe(board);
    expect(board).toHaveAttribute('aria-valuenow', '1');
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    expect(board).toHaveAttribute('aria-valuenow', '3');
    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    expect(board).toHaveAttribute('aria-valuetext', 'Frets 2 to 6');
    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    expect(board).toHaveAttribute('aria-valuenow', '1');
  });

  it('highlights the root notes in the window', () => {
    render(<Harness />);
    // C on frets 1-5: B fret 1, G fret 5, A fret 3
    expect(screen.getAllByTestId('glasses-root')).toHaveLength(3);
  });

  it('flips Left/Right when left-handed', () => {
    render(<Harness isLefty />);
    const board = screen.getByTestId('glasses-fretboard');
    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    fireEvent.keyDown(board, { key: 'ArrowLeft' });
    expect(board).toHaveAttribute('aria-valuenow', '3');
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    expect(board).toHaveAttribute('aria-valuenow', '2');
  });

  it('does not take focus back after re-renders', () => {
    render(<Harness />);
    const board = screen.getByTestId('glasses-fretboard');
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(outside);
  });
});
