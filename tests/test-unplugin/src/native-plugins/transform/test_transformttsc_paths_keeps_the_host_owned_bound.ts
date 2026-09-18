import assert from "node:assert/strict";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies a plugin that declares no completeness keeps the host-owned watch
 * bound.
 *
 * `@ttsc/paths` deliberately declares nothing: which source files the program
 * contains decides whether an alias target resolves, and the Checker decides
 * whether a bare `require` is the module loader. This negative twin also pins
 * that narrowing comes from the declaration rather than from the host stamping
 * every linked-plugin envelope.
 *
 * 1. Create a project whose only plugin is `@ttsc/paths`.
 * 2. Collect the entry module's watch inputs.
 * 3. Assert the type-only sibling is still registered.
 */
export async function test_transformttsc_paths_keeps_the_host_owned_bound(): Promise<void> {
  const project = createLinkedPluginProject(["paths"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    true,
    `a paths-only project must keep registering the entry's reference closure; watched: ${watched.join(", ")}`,
  );
}
