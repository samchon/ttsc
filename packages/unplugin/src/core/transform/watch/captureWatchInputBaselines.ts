import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { compilerAccessibleEntries } from "../inputs/compilerAccessibleEntries";
import { compilerInputRealpathObservation } from "../inputs/compilerInputRealpathObservation";
import { compilerInputTextHash } from "../inputs/compilerInputTextHash";
import { compilerStatKind } from "../inputs/compilerStatKind";
import { pluginSourceState } from "../inputs/pluginSourceState";
import { hashText } from "../utils/hashText";
import { stableStringify } from "../utils/stableStringify";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";

/**
 * Capture a batch through two independently fresh native observation phases.
 * A phase shares path/case observations only within this synchronous batch;
 * the second phase has a new identity context and rereads every input. Nothing
 * survives this call. Changed captures or escaping exceptions decline that
 * input alone.
 * Matching endpoints still cannot certify an atomic snapshot or exclude ABA.
 *
 * One current byte read supplies raw-host and compiler-text hashes in each
 * phase. Failed reads retain native kind fallbacks; optional tree and listing
 * observations keep their original owners and are captured in both phases.
 *
 * @evidence contracts/common.md#principled-implementation Each returned input has equal before/after facts from independent identity contexts and actual reads. Sharing directory resolution within a phase never supplies the second phase or a later batch; failed captures remain undefined independently of siblings.
 * @evidence contracts/common.md#clear-and-simple-design Two phase maps surround one per-path fact collector, sharing the existing decoder, native predicates and optional tree/listing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No lifetime or historical identity memo enters this API. Both phases run for every selected spelling and compare complete facts, including identity and realpath; equality does not invent atomicity or exclude unobserved changes.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines phase ownership, shared byte provenance, rejection and the remaining temporal limitation.
 * @evidence contracts/portability.md#os-neutral-implementation The coherent supplied filesystem provides native case, path, read, kind and listing capabilities. Each phase re-establishes aliases and case policy; no platform label supplies authority, and raw host bytes remain distinct from compiler-decoded text.
 * @evidence contracts/performance.md#efficient-algorithms Two passes visit N unique spellings and read each path at most once per phase, sharing directory/case resolution within that phase. Native ancestor/path work, total bytes B, optional listing/tree populations and digest serialization remain costs; two maps retain O(N) baseline facts rather than historical generations.
 * @evidence contracts/performance.md#reuse-equivalent-work Phase-local identity contexts reuse the same native namespace observation for related paths, and one actual byte observation supplies its two codecs. A new context and new reads are mandatory in the second phase and every later invocation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned baselines are caller-owned; both identity contexts and phase maps are synchronous call-local values with no timer, watcher or retained cache.
 */
export function captureWatchInputBaselines(
  files: Iterable<string>,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  options: { tree?: boolean; accessibleEntries?: boolean } = {},
): Map<string, TtscWatchInputBaseline | undefined> {
  const selected = [...new Set(files)];
  const observe = (): Map<string, TtscWatchInputBaseline | undefined> => {
    const identities = createHostPathIdentityContext(filesystem);
    return new Map(
      selected.map((file) => {
        try {
          return [file, capture(file, filesystem, identities, options)] as const;
        } catch {
          return [file, undefined] as const;
        }
      }),
    );
  };
  const before = observe();
  const after = observe();
  for (const file of selected) {
    if (
      before.get(file) === undefined ||
      stableStringify(before.get(file)) !== stableStringify(after.get(file))
    )
      after.set(file, undefined);
  }
  return after;
}

/** Capture one path's codec facts from this phase's fresh namespace view. */
function capture(
  file: string,
  filesystem: TtscTransformFilesystemOperations,
  identities: FilesystemPathIdentityContext,
  options: { tree?: boolean; accessibleEntries?: boolean },
): TtscWatchInputBaseline {
  const stat = compilerStatKind(file, filesystem);
  let bytes: Buffer | undefined;
  try {
    bytes = filesystem.readFile(file);
  } catch {
    // Failed reads keep their explicit codec fallbacks.
  }
  const graphReadHash =
    stat === "directory" || bytes === undefined
      ? null
      : compilerInputTextHash(bytes);
  const directoryHash = hashText("ttsc:host-input:directory\0");
  const hostHash =
    bytes === undefined
      ? compilerStatKind(file, filesystem) === "directory"
        ? directoryHash
        : MISSING_INPUT_STATE
      : hashText(bytes);
  return {
    ...(options.accessibleEntries === true
      ? { accessibleEntries: compilerAccessibleEntries(file, filesystem) }
      : {}),
    directoryExists: stat === "directory",
    fileExists: stat === "file",
    graphHash:
      graphReadHash ??
      (stat === "directory" ? directoryHash : MISSING_INPUT_STATE),
    graphReadHash,
    hostHash,
    identity: pathIdentityKey(file, identities),
    realpath: compilerInputRealpathObservation(file, filesystem),
    stat,
    ...(options.tree === true ? { tree: pluginSourceState(file) } : {}),
  };
}
