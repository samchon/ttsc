import type { ProjectInputPathIdentityContext } from "./ProjectInputPathIdentityContext";
import type { ProjectInputPathIdentityOperations } from "./ProjectInputPathIdentityOperations";
import { createFilesystemPathIdentityContext } from "./createFilesystemPathIdentityContext";

/**
 * Create the identity resolver used for project inputs.
 *
 * It is {@link createFilesystemPathIdentityContext} under the project-input
 * name, kept as its own entry point so the watch, build, and LSP hosts that
 * reason about project inputs read as such while sharing one implementation.
 *
 * @param operations Replaceable filesystem primitives; omitted members use the
 *   host's own.
 *
 * @evidence contracts/common.md#principled-implementation Returning the filesystem context gives project consumers identical realpath, missing-suffix and case-policy decisions instead of a second identity relation.
 * @evidence contracts/common.md#clear-and-simple-design This domain entry point delegates its entire policy and retains only a project-oriented name for watch, build and LSP callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Operations use the supported injection boundary; neither native methods nor foreign globals are patched to change identity.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the domain name, shared implementation and omitted-operation defaults, with tags visibly separate.
 * @evidence contracts/portability.md#os-neutral-implementation The owning resolver uses actual native case evidence and path syntax; unavailable policy remains unknown and preserves identity spellings instead of assuming an OS-default filesystem capability.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources createProjectInputPathIdentityContext declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms createProjectInputPathIdentityContext declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work createProjectInputPathIdentityContext declares a signature only; the implementation owns any shared work.
 */
export function createProjectInputPathIdentityContext(
  operations: Partial<ProjectInputPathIdentityOperations> = {},
): ProjectInputPathIdentityContext {
  return createFilesystemPathIdentityContext(operations);
}
