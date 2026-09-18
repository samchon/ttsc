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
 */
export function createProjectInputPathIdentityContext(
  operations: Partial<ProjectInputPathIdentityOperations> = {},
): ProjectInputPathIdentityContext {
  return createFilesystemPathIdentityContext(operations);
}
