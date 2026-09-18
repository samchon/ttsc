import assert from "node:assert/strict";
import path from "node:path";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies the declaration survives a compile through the generated tsconfig.
 *
 * Any bundler alias makes the adapter compile through a wrapper tsconfig in the
 * system temp directory, so the host's cwd is no longer the project root and
 * every envelope section — `typescript`, `graph`, and now
 * `dependenciesComplete` — is keyed as an absolute path instead of a
 * project-relative one. A declaration the consumer cannot join back to the file
 * it names would silently stop narrowing, which is invisible except as the cost
 * it was supposed to remove.
 */
export async function test_transformttsc_banner_narrows_through_the_alias_overlay(): Promise<void> {
  const project = createLinkedPluginProject(["banner"]);
  const watched = await collectEntryWatchInputs(project, {
    "@lib": path.join(project.root, "src"),
  });

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `the declaration must survive the generated tsconfig's key convention; watched: ${watched.join(", ")}`,
  );
}
