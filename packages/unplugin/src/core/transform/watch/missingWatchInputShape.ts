import type { TtscMissingWatchInputShape } from "./TtscMissingWatchInputShape";
import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * What must appear at a `missing` watch input for the compiler's view of it to
 * change, so a host whose channels each observe one kind of creation, or whose
 * file channel cannot take a directory, can take the one that sees it.
 *
 * Turbopack is such a host: its file channel reads the path, and the read fails
 * on a directory, so a missing path that may come back as one takes its
 * directory channel instead (see the Turbopack loader). esbuild is another: for
 * an absent path, its `watchFiles` fires only when a file appears and its
 * `watchDirs` only when a directory does, and it keeps one watch state per
 * path, so the same path cannot sit in both.
 *
 * - `directory`: a `DirectoryExists` or `GetAccessibleEntries` probe, which
 *   changes only when a directory appears.
 * - `file`: a `FileExists` or `ReadFile` probe, or a graph input recorded
 *   unavailable as a file, which changes only when a file appears.
 * - `either`: a `Stat` or `Realpath` probe, probes of both kinds on one path, or
 *   a recovery registration, which carries no evidence of what the compiler
 *   looked for.
 */
export function missingWatchInputShape(
  input: TtscWatchInput,
): TtscMissingWatchInputShape {
  const evidence = input.evidence;
  if (evidence === undefined) return "either";
  const observation =
    evidence.state?.codec === "predicates"
      ? evidence.state.observation
      : undefined;
  if (observation === undefined) return "file";
  if (observation.stat === "missing" || observation.realpath?.ok === false)
    return "either";
  const directory =
    observation.directoryExists === false ||
    observation.accessibleEntries !== undefined;
  const file =
    observation.fileExists === false || observation.readFile?.ok === false;
  // Neither probe recorded means the absence came from elsewhere, so nothing
  // narrows what may appear.
  if (directory === file) return "either";
  return directory ? "directory" : "file";
}
