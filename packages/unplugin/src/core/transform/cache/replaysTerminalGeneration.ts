import { TtscPassVerdictError } from "../errors/TtscPassVerdictError";
import type { TtscTerminalGenerationError } from "../errors/TtscTerminalGenerationError";
import { TtscUnstableGenerationError } from "../errors/TtscUnstableGenerationError";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { failedGenerationEnvironmentChanged } from "../generation/failedGenerationEnvironmentChanged";

/**
 * Whether a terminal verdict still answers for this delivery.
 *
 * Inside the pass that produced or confirmed it, it is replayed without
 * re-probing anything: the pass settles every delivery against the state it
 * started from, so re-walking the project once per module would spend exactly
 * the cost this gate exists to remove.
 *
 * Across passes the two kinds part company. A pass verdict is dropped, because
 * a new pass is the first boundary at which the host itself claims something
 * may have changed, and the compile it stood for was never proven against a
 * recorded environment. An unstable generation was, so it keeps its own rule:
 * one fresh attempt per pass, and otherwise replayed until that recorded
 * environment provably moves.
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
