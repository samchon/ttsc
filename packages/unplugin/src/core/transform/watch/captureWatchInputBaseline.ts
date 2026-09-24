import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { compilerInputRealpathObservation } from "../inputs/compilerInputRealpathObservation";
import { compilerStatKind } from "../inputs/compilerStatKind";
import { graphInputReadHash } from "../inputs/graphInputReadHash";
import { graphInputStateHash } from "../inputs/graphInputStateHash";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { pluginSourceState } from "../inputs/pluginSourceState";
import { stableStringify } from "../utils/stableStringify";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";

/**
 * Capture one stable main-process baseline that can be compared with any
 * generation-owned watch-input evidence. Two equal broad observations are
 * required so a cache key never publishes a torn path state.
 *
 * @param options.tree Whether the path was recorded as a plugin source
 *   directory, whose state the baseline then carries (samchon/ttsc#1487).
 */
export function captureWatchInputBaseline(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  options: { tree?: boolean } = {},
): TtscWatchInputBaseline | undefined {
  const capture = (): TtscWatchInputBaseline => {
    const identities = createHostPathIdentityContext(filesystem);
    const stat = compilerStatKind(file, filesystem);
    return {
      directoryExists: stat === "directory",
      fileExists: stat === "file",
      graphHash: graphInputStateHash(file, filesystem) ?? MISSING_INPUT_STATE,
      graphReadHash: graphInputReadHash(file, filesystem),
      hostHash: hostInputStateHash(file, filesystem) ?? MISSING_INPUT_STATE,
      identity: pathIdentityKey(file, identities),
      realpath: compilerInputRealpathObservation(file, filesystem),
      stat,
      ...(options.tree === true ? { tree: pluginSourceState(file) } : {}),
    };
  };
  try {
    const before = capture();
    const after = capture();
    return stableStringify(before) === stableStringify(after)
      ? after
      : undefined;
  } catch {
    return undefined;
  }
}
