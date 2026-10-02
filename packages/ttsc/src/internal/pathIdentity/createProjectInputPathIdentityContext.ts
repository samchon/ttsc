import type { ProjectInputPathIdentityContext } from "./ProjectInputPathIdentityContext";
import type { ProjectInputPathIdentityOperations } from "./ProjectInputPathIdentityOperations";
import { createFilesystemPathIdentityContext } from "./createFilesystemPathIdentityContext";

/**
 * Create the identity resolver used for project inputs.
 *
 * It is {@link createFilesystemPathIdentityContext} under the project-input
 * name, kept as its own entry point so the watch, build, and LSP hosts that
 * reason about project inputs read as such while sharing one implementation.
 * Each call creates a new context; it does not reuse another transaction's
 * observations. Creation allocates maps and closures without querying native
 * paths. Later method calls perform the underlying resolver's native or injected
 * observations, including a read-only Windows case query when selected.
 * The caller chooses the observation lifetime by retaining or discarding the
 * returned context; no explicit dispose operation or map eviction is supplied.
 *
 * @param operations Replaceable filesystem primitives; omitted members use the
 *   host's own.
 *
 * @evidence contracts/common.md#principled-implementation Returning the filesystem context gives project consumers identical realpath, missing-suffix and case-policy decisions instead of a second identity relation.
 * @evidence contracts/common.md#clear-and-simple-design This domain entry point delegates its entire policy and retains only a project-oriented name for watch, build and LSP callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Operations use the supported injection boundary; neither native methods nor foreign globals are patched to change identity.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the domain name, shared implementation and omitted-operation defaults, with tags visibly separate.
 * @evidence contracts/portability.md#os-neutral-implementation The owning resolver uses actual native case evidence and path syntax; unavailable policy remains unknown and preserves identity spellings instead of assuming an OS-default filesystem capability.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The returned context owns maps whose queried path/ancestor populations have no internal eviction bound; its lifetime and injected-operation references pass to the caller. Creation opens no native handle, and the alias adds no disposal or observation-freshness guarantee.
 * @evidence contracts/performance.md#efficient-algorithms Construction delegates fixed map/closure allocation without path traversal. Actual context method calls incur the shared resolver's path/ancestor/entry/native-probe work; delegating does not make those later costs constant or impose a population cap.
 * @evidence contracts/performance.md#reuse-equivalent-work Each new context independently memoizes per-key observations within its caller-chosen transaction, including missing paths and unknown case answers. No context is shared across calls, and cached observations are not a fresh filesystem snapshot.
 */
export function createProjectInputPathIdentityContext(
  operations: Partial<ProjectInputPathIdentityOperations> = {},
): ProjectInputPathIdentityContext {
  return createFilesystemPathIdentityContext(operations);
}
