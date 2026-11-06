// With continuous drag on (body touch-action:none), Meta Ray-Ban Display
// delivers a pinch/tap as touch pointer events at a screen position rather
// than as Enter on the focused control. This sends such a tap to the control
// the user had selected, and keeps it from stealing focus. Mouse input (desktop)
// is left alone, and so is a tap that lands on the focused control itself.
const TAP_SLOP_PX = 12;

const isControl = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement &&
  el.matches('button, a[href], [role="button"], input, select');

export function routeTapsToFocusedControl(doc: Document): () => void {
  let tap: { x: number; y: number; control: HTMLElement } | null = null;

  const shouldRoute = (target: EventTarget | null) =>
    tap !== null && !(target instanceof Node && tap.control.contains(target));

  const onPointerDown = (event: PointerEvent) => {
    const focused = doc.activeElement;
    tap =
      event.pointerType !== 'mouse' && isControl(focused)
        ? { x: event.clientX, y: event.clientY, control: focused }
        : null;
    // Keep the selected control focused (stops compat mousedown focusing).
    if (shouldRoute(event.target)) event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (
      tap &&
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > TAP_SLOP_PX
    )
      tap = null; // a drag, not a tap
  };
  const onMouseDown = (event: MouseEvent) => {
    if (shouldRoute(event.target)) event.preventDefault();
  };
  const onClick = (event: MouseEvent) => {
    if (!event.isTrusted || !shouldRoute(event.target)) return;
    const control = tap!.control;
    tap = null;
    event.preventDefault();
    event.stopPropagation();
    control.focus();
    control.click();
  };

  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('pointermove', onPointerMove, true);
  doc.addEventListener('mousedown', onMouseDown, true);
  doc.addEventListener('click', onClick, true);
  return () => {
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('mousedown', onMouseDown, true);
    doc.removeEventListener('click', onClick, true);
  };
}
