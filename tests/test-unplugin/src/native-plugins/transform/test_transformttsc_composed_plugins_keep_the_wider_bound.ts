import assert from "node:assert/strict";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies the aggregation rule over a composed plugin set.
 *
 * Completeness is per (plugin, file) and a consumer cannot attribute one
 * plugin's reported inputs back to it, so a file is complete only when every
 * contributing plugin declared it. A declaring plugin beside a silent one
 * therefore keeps the wider bound, not the narrower one.
 */
export async function test_transformttsc_composed_plugins_keep_the_wider_bound(): Promise<void> {
  const project = createLinkedPluginProject(["banner", "paths"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    true,
    `a declaring plugin beside a silent one must keep the union bound; watched: ${watched.join(", ")}`,
  );
}
