import { TtscPassVerdictError } from "../errors/TtscPassVerdictError";
import type { TtscTerminalGenerationError } from "../errors/TtscTerminalGenerationError";
import { TtscUnstableGenerationError } from "../errors/TtscUnstableGenerationError";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { failedGenerationEnvironmentChanged } from "../generation/failedGenerationEnvironmentChanged";

/**
 * Whether a terminal verdict still answers for this delivery.
 *
 * A pass verdict is replayed without re-probing anything inside the pass that
 * produced it: the pass settles every delivery against the state it started
 * from, so re-walking the project once per module would spend exactly the cost
 * this gate exists to remove.
 *
 * An unstable generation has a recorded environment, and it is confirmed
 * against the disk on every delivery (`failedGenerationEnvironmentChanged`,
 * which shares one project walk per event-loop turn). The pass does not cache
 * that answer. Inside a pass, only a verdict captured in that pass is replayed;
 * one captured in an earlier pass grants a fresh attempt.
 *
 * Across passes the two kinds part company. A pass verdict is dropped, because
 * a new pass is the first boundary at which the host itself claims something
 * may have changed, and the compile it stood for was never proven against a
 * recorded environment. An unstable generation was, so it keeps its own rule:
 * one fresh attempt per pass, and otherwise replayed until that recorded
 * environment provably moves.
 *
 * @evidence contracts/common.md#principled-implementation A pass verdict replays only in its own epoch; an unstable-generation verdict requires its recorded environment to remain unchanged and permits a new attempt in a new pass.
 * @evidence contracts/common.md#clear-and-simple-design Explicit error-kind branches preserve their different evidence instead of applying one blanket retry policy to every terminal error.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown error kinds are not authorized for replay, and epoch equality cannot replace an unstable generation's environment proof.
 * @evidence contracts/common.md#meaningful-documentation The paragraphs and branch comments explain why pass failures and recorded instability have different replay boundaries.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; the verdict objects belong to the cache entry.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A few constant-time comparisons plus the environment check delegated to failedGenerationEnvironmentChanged.
 * @evidence contracts/performance.md#reuse-equivalent-work It decides whether a failed verdict is replayed instead of repeating a whole-project compile: a pass verdict by its epoch, an unstable one by its recorded environment.
 */
export function replaysTerminalGeneration(
  terminal: TtscTerminalGenerationError,
  epoch: number | undefined,
  props: {
    currentFile: string;
    currentSource: string;
    filesystem: TtscTransformFilesystemOperations;
  },
): boolean {
  if (terminal instanceof TtscPassVerdictError) {
    // A pass verdict has no recorded environment to re-confirm against, so the
    // pass that produced it is its whole scope.
    return epoch !== undefined && terminal.epoch === epoch;
  }
  if (!(terminal instanceof TtscUnstableGenerationError)) {
    return false;
  }
  // An unstable generation does have one, and confirming it per delivery is the
  // behaviour its own contract describes, so the pass does not cache that
  // answer. A new pass still grants the fresh attempt the per-pass cache clear
  // used to give it.
  if (
    epoch !== undefined &&
    terminal.validation.cached.deliveryEpoch !== epoch
  ) {
    return false;
  }
  return !failedGenerationEnvironmentChanged(terminal.validation, props);
}
