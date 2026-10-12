// Live Fretboard orientation rules (desktop/README.md "Live Fretboard").
//
// Two independent flips:
// - Model flip (D1): the tracker needs a right-handed view. getUserMedia and
//   video files deliver unmirrored pixels, so the frame shows a lefty exactly
//   when the page-level Left-handed setting is on.
// - Display mirror (selfie view): live cameras are shown mirrored, like a
//   mirror, unless the camera reports that it faces away from the user
//   (facingMode "environment"). Video files are shown as recorded.
// The tracker answers in source pixels, so the overlay follows either flip.

export type LiveSourceKind = 'camera' | 'file';

export function modelFlip(isLefty: boolean): boolean {
  return isLefty;
}

export function displayMirror(
  kind: LiveSourceKind,
  facingMode?: string,
): boolean {
  return kind === 'camera' && facingMode !== 'environment';
}
