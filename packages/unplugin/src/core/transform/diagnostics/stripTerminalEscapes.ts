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
 *
 * @evidence contracts/common.md#principled-implementation The regular expression removes ANSI CSI control sequences from the presentation string, retaining ordinary diagnostic text; other terminal protocols are outside its current grammar.
 * @evidence contracts/common.md#clear-and-simple-design One replacement owns the supported escape grammar, so every caller uses the same presentation boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The grammar follows control-sequence syntax without matching fixture-specific colours, exception messages or expected output.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain the nonterminal destination and inline comments explain the deliberately visible expression construction.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   One regular-expression replace, linear in the text length.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Builds its small escape-sequence RegExp per call; the cost is constant
 *   and the input is error text only.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function stripTerminalEscapes(text: string): string {
  // Built from a char code so no control byte lives in this source file, and
  // written with `[[]` (a class holding one literal bracket) so the pattern
  // needs no backslash escapes to survive the string it is assembled from.
  const escape = String.fromCharCode(27);
  const controlSequence = new RegExp(escape + "[[][0-9;?]*[ -/]*[@-~]", "g");
  return text.replace(controlSequence, "");
}
