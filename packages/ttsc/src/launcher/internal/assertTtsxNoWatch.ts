import { CompilerArgumentsInspection } from "../../compiler/internal/CompilerArgumentsInspection";
import { readCompilerOptionOccurrence } from "../../flags/readCompilerOptionOccurrence";
import { readCompilerOptionValues } from "../../flags/readCompilerOptionValues";
import { resolveFlagSpec } from "../../flags/resolveFlagSpec";

/**
 * Refuse `--watch` (or `-w`) before the one-shot ttsx check or build starts.
 *
 * A watch that restarts the program is a different feature; the message names
 * the tools that provide its two halves. Arguments after the entry belong to
 * the program and never reach this guard. Parsing supplies its compiler tokens
 * without a cwd and remains in-memory. Preparation supplies the selected
 * project's actual compiler cwd, after project/reference discovery and before
 * effective-option reporting, cache writes or a checked build, to inspect
 * response frames through their shared owner.
 *
 * Even an explicit false/null watch request is unsupported, matching direct
 * launcher flags. Inspection failures propagate before a build starts. The
 * observation does not pin response bytes against subsequent filesystem edits.
 *
 * @evidence contracts/common.md#principled-implementation The same refusal owns direct launcher requests and observed response options; native occurrence widths preserve scalar operands and preparation supplies the selected project root.
 * @evidence contracts/common.md#clear-and-simple-design One mode guard serves parsing and the pre-build boundary, delegating response expansion to the existing inspection owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No compiler grammar or watcher behavior is replaced; unsupported watch requests throw before execution and inspection failures remain failures.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish direct parsing, project-relative response observation and program argv, and state the observation's lifetime limit.
 * @evidence contracts/portability.md#os-neutral-implementation Response resolution and UTF decoding belong to the shared native filesystem inspector; the guard receives a native directory rather than assuming the invocation cwd.
 * @evidence contracts/performance.md#efficient-algorithms One occurrence scan finds response requests and another finds watch. When expansion is needed its delegated path/read/hash/token costs follow all expanded bytes, depth and occurrences without a fixed cap.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each admission observes the current response contents and retains no historical answer.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Inspection transfers call-local arrays and synchronous observations; this guard retains no handles, process or cache.
 */
export function assertTtsxNoWatch(
  args: readonly string[],
  compilerCwd?: string,
): void {
  if (
    compilerCwd !== undefined &&
    readCompilerOptionValues(args).responseFiles.length !== 0
  ) {
    args = CompilerArgumentsInspection.inspect(args, compilerCwd).args;
  }
  let watching = false;
  for (let index = 0; !watching && index < args.length; ) {
    watching = resolveFlagSpec(args[index]!)?.name === "--watch";
    index += readCompilerOptionOccurrence(args, index).width;
  }
  if (!watching) return;
  throw new Error(
    "ttsx: --watch is not supported; ttsx type-checks once and then runs the entry. For a watching type-check use `ttsc --watch --noEmit`; to restart the program on changes use `node --watch --require ttsc/register <entry.ts>`. Arguments after the entry, including --watch, go to the program.",
  );
}
