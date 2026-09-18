import assert from "node:assert/strict";
import path from "node:path";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies a program plugin can declare completeness too.
 *
 * `@ttsc/strip` removes statements matching configured patterns and reads
 * nothing else, so it declares from `ApplyProgram`. Paired with the banner
 * case, this pins both hooks the host counts as contributors.
 *
 * 1. Create a project whose only plugin is `@ttsc/strip`.
 * 2. Collect the entry module's watch inputs.
 * 3. Assert the type-only sibling is absent while `tsconfig.json` and
 *    `strip.config.json` are present.
 */
export async function test_transformttsc_strip_narrows_the_entry_watch_inputs(): Promise<void> {
  const project = createLinkedPluginProject(["strip"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `a strip-only project must not register the entry's type-only sibling; watched: ${watched.join(", ")}`,
  );
  // The same two assertions the banner case makes: a list that collapsed to
  // nothing would also drop the sibling, and would be a far worse bug.
  assert.ok(
    watched.includes(path.resolve(path.join(project.root, "tsconfig.json"))),
    "the config chain stays universal for a file declared complete",
  );
  assert.ok(
    watched.includes(
      path.resolve(path.join(project.root, "strip.config.json")),
    ),
    "the plugin's own config remains a universal host input",
  );
}
