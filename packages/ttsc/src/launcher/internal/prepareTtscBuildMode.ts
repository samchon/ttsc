import type { parseTtscBuildArgs } from "./parseTtscBuildArgs";
import type { TtscBuildMode } from "./TtscBuildMode";

/**
 * Apply the command constraints before any compiler lane is entered.
 *
 * Watch constraints precede single-file constraints. Watch keeps the parsed emit option for its own check-only adapter;
 * one-shot check, fix and format always pass emit false to their chosen lane.
 * Fix and format record their mode on the supplied invocation options in place;
 * one-shot non-build mode returns a shallow copy with emission suppressed.
 *
 * @evidence contracts/common.md#principled-implementation Emit-conflict, watch and single-file validation run in that order with fixed error messages; the execution layer consumes this same decision before starting any host.
 * @evidence contracts/common.md#clear-and-simple-design One small mode adapter owns validation and mode flags; project normalization and actual watch/build execution stay with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither flags nor invalid combinations are ignored; watch validation is not reordered behind single-file validation and explicit emit conflicts retain their precedence.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains watch versus one-shot emit ownership and the validation order, enabling direct unit verification of the maintained decision.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Mutates or copies only the supplied options object and retains nothing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A fixed sequence of option checks that either throws or returns the options object; nothing loops over inputs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Applies one mode to one options object per call; there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This mode adapter inspects booleans and whether the parsed file list is empty; it does not interpret native file paths, spawn a process or acquire an OS capability.
 */
export function prepareTtscBuildMode(
  options: ReturnType<typeof parseTtscBuildArgs>,
  mode: TtscBuildMode,
): ReturnType<typeof parseTtscBuildArgs> {
  if (mode === "fix") {
    if (options.emit === true) {
      throw new Error("ttsc: fix and --emit are mutually exclusive");
    }
    options.fix = true;
    options.emit = false;
  }
  if (mode === "format") {
    if (options.emit === true) {
      throw new Error("ttsc: format and --emit are mutually exclusive");
    }
    options.format = true;
    options.emit = false;
  }
  if (options.watch) {
    if (mode === "fix") {
      throw new Error("ttsc: fix does not support watch mode; use ttsc --noEmit --watch for incremental checks");
    }
    if (mode === "format") {
      throw new Error("ttsc: format does not support watch mode; use ttsc --noEmit --watch for incremental checks");
    }
    return options;
  }
  if (options.files.length !== 0) {
    if (mode === "fix") {
      throw new Error("ttsc: fix requires a project, not single-file mode");
    }
    if (mode === "format") {
      throw new Error("ttsc: format requires a project, not single-file mode");
    }
  }
  return mode === "build" ? options : { ...options, emit: false };
}
