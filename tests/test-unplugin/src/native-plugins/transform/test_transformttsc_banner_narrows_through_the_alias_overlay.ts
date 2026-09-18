import assert from "node:assert/strict";
import path from "node:path";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies the completeness declaration survives a compile through the
 * generated tsconfig.
 *
 * A bundler alias makes the adapter compile through a wrapper tsconfig in the
 * system temp directory, so the host's working directory is no longer the
 * project root and every envelope section, `dependenciesComplete` included, is
 * keyed by absolute path instead of project-relative path. A declaration the
 * adapter cannot join back to its file would silently stop narrowing, which is
 * invisible except as the cost it was meant to remove.
 *
 * 1. Create a project whose only plugin is `@ttsc/banner`.
 * 2. Collect the entry module's watch inputs with a bundler alias.
 * 3. Assert the type-only sibling is absent.
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
