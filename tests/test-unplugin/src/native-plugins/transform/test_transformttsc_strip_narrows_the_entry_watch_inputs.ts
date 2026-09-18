import assert from "node:assert/strict";
import path from "node:path";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies a program plugin can make the same declaration.
 *
 * `@ttsc/strip` removes statements matching configured patterns and reads
 * nothing else, so it declares from `ApplyProgram`. Pairing this with the
 * banner case pins both hooks the host counts as contributors.
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
