/**
 * Remove terminal colour and cursor sequences from text the adapter surfaces.
 *
 * An opaque host exception can contain the host's own rendered output, colour
 * and all, with no structured diagnostics to format instead. What the adapter
 * hands back is not going to a terminal: it becomes the `Error` a bundler
 * reports, so it lands in a Vite overlay, a webpack error report or a CI
 * annotation, where the escapes render as literal noise around the file and
 * line the reader needs (samchon/ttsc#1312).
 *
 * The colour originates in the host's rendering rather than in anything this
 * adapter configures, so this is the adapter-side repair, applied to every
 * message it surfaces rather than to one call site.
 */
export function stripTerminalEscapes(text: string): string {
  // Built from a char code so no control byte lives in this source file, and
  // written with `[[]` (a class holding one literal bracket) so the pattern
  // needs no backslash escapes to survive the string it is assembled from.
  const escape = String.fromCharCode(27);
  const controlSequence = new RegExp(escape + "[[][0-9;?]*[ -/]*[@-~]", "g");
  return text.replace(controlSequence, "");
}
