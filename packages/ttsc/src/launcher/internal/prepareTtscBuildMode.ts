import type { parseTtscBuildArgs } from "./parseTtscBuildArgs";

/**
 * Supported compiler commands sharing the launcher build adapter. Mutation
 * commands reject watch and single-file modes; check suppresses one-shot emit.
 *
 * @evidence contracts/common.md#principled-implementation Four literal commands represent exactly the existing launcher's compatible build lanes.
 * @evidence contracts/common.md#clear-and-simple-design A closed union lets the same command decision serve CLI execution and direct unit verification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported command strings cannot enter the adapter through this maintained type.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the supported command distinction and its mutation/check consequences.
 */
export type TtscBuildMode = "build" | "check" | "fix" | "format";

/**
 * Apply the original command constraints before any compiler lane is entered.
 *
 * Watch constraints precede single-file constraints, as in the original
 * launcher. Watch keeps the parsed emit option for its own check-only adapter;
 * one-shot check, fix and format always pass emit false to their chosen lane.
 * The supplied invocation options retain the original fix/format mutation;
 * one-shot non-build mode returns a shallow copy with emission suppressed.
 *
 * @evidence contracts/common.md#principled-implementation Preserves the launcher's emit, watch and single-file validation order and exact errors; the execution layer consumes this same decision before starting any host.
 * @evidence contracts/common.md#clear-and-simple-design One small mode adapter owns validation and mode flags; project normalization and actual watch/build execution stay with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither flags nor invalid combinations are ignored; watch validation is not reordered behind single-file validation and explicit emit conflicts retain their precedence.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains watch versus one-shot emit ownership and the original validation order, enabling direct unit verification of the maintained decision.
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
