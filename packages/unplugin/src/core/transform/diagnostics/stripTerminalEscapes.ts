/**
 * Remove ANSI CSI colour and cursor sequences from surfaced text.
 *
 * An opaque host exception can contain the host's own rendered output, colour
 * and all, with no structured diagnostics to format instead. What the adapter
 * hands back is not going to a terminal: it becomes the `Error` a bundler
 * reports, so it lands in a Vite overlay, a webpack error report or a CI
 * annotation, where the escapes render as literal noise around the file and
 * line the reader needs. Other terminal protocols, including OSC hyperlinks,
 * are outside this grammar and remain in the returned text.
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
 * @evidence contracts/performance.md#efficient-algorithms
 *   One CSI replacement scans message text in linear time; the two repeated
 *   character classes are disjoint and cannot consume the escape introducer.
 *   Output storage is at most the input length.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   All message formatters reuse the same private compiled CSI expression.
 *   Global String.replace resets its matching position for each synchronous
 *   call; no input-dependent result or mutable caller text is cached.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   One fixed compiled expression lives with the module; no input text or
 *   replacement result survives a call. No handle or running task is acquired.
 */
export function stripTerminalEscapes(text: string): string {
  return text.replace(CONTROL_SEQUENCE, "");
}

// A character code keeps the control byte out of maintained source. `[[]`
// spells one literal bracket without an additional string-escape layer.
const CONTROL_SEQUENCE = new RegExp(
  String.fromCharCode(27) + "[[][0-9;?]*[ -/]*[@-~]",
  "g",
);
