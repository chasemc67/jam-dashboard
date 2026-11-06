import { routeTapsToFocusedControl } from './glassesTaps';

const pointer = (type: string, target: Element, pointerType: string) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  target.dispatchEvent(event);
  return event;
};

describe('routeTapsToFocusedControl', () => {
  it('keeps focus on the selected button for a touch tap elsewhere', () => {
    document.body.innerHTML =
      '<button id="a">A</button><div id="board" tabindex="0"></div>';
    const a = document.getElementById('a')!;
    const board = document.getElementById('board')!;
    const stop = routeTapsToFocusedControl(document);
    a.focus();
    const down = pointer('pointerdown', board, 'touch');
    expect(down.defaultPrevented).toBe(true);
    const mouse = pointer('mousedown', board, 'touch');
    expect(mouse.defaultPrevented).toBe(true);
    stop();
  });

  it('ignores mouse input', () => {
    document.body.innerHTML =
      '<button id="a">A</button><div id="board" tabindex="0"></div>';
    const a = document.getElementById('a')!;
    const stop = routeTapsToFocusedControl(document);
    a.focus();
    const down = pointer(
      'pointerdown',
      document.getElementById('board')!,
      'mouse',
    );
    expect(down.defaultPrevented).toBe(false);
    stop();
  });
});
