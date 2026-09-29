import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { compilerAccessibleEntries } from "../inputs/compilerAccessibleEntries";
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
 * Capture a main-process baseline comparable with generation-owned evidence.
 * Two equal broad observations are required; an observed mismatch or exception
 * declines the capture. Equality does not establish an atomic snapshot or rule
 * out a transient change between reads.
 *
 * @param options.tree Whether the path was recorded as a plugin source
 *   directory, whose state the baseline then carries (samchon/ttsc#1487).
 * @param options.accessibleEntries Whether compiler listing names are needed
 *   by a recorded predicate. Unrequested listings are not enumerated.
 *
 * @evidence contracts/common.md#principled-implementation Two independently captured codec facts must agree before a baseline is returned; equality detects observed changes but cannot establish absence of intervening unobserved changes.
 * @evidence contracts/common.md#clear-and-simple-design One local capture assembles comparison facts, while the outer operation owns repeated observation and failure-to-undefined handling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed reads and observed changes decline capture rather than supplying expected state or repeating indefinitely until a desired answer appears.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain capture rejection, equality limitations and optional subtree cost, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Stat, hash and identity use supplied native operations. Plugin-tree capture uses the shared native build-state owner, so an injected view must describe that same source tree.
 * @evidence contracts/performance.md#efficient-algorithms Two fixed broad captures cost file-byte and identity work, with optional O(T) plugin-tree observation or O(E log E) listing sorting; unrequested trees and listings are not scanned and fresh identity contexts avoid reusing the first capture's metadata.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Independent current observations are the purpose of capture; the caller owns subsequent baseline reuse and its validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Hash buffers and identity contexts are call-local; this capture retains no cache, native handle or task.
 */
export function captureWatchInputBaseline(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  options: { tree?: boolean; accessibleEntries?: boolean } = {},
): TtscWatchInputBaseline | undefined {
  const capture = (): TtscWatchInputBaseline => {
    const identities = createHostPathIdentityContext(filesystem);
    const stat = compilerStatKind(file, filesystem);
    return {
      ...(options.accessibleEntries === true
        ? { accessibleEntries: compilerAccessibleEntries(file, filesystem) }
        : {}),
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
