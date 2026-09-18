import assert from "node:assert/strict";
import path from "node:path";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies a preamble plugin's declaration narrows the entry's watch inputs.
 *
 * `@ttsc/banner` prepends one text derived from `banner.config.*` to every
 * file, so nothing in a sibling's content can reach the output. Its declaration
 * (through `SourcePreamble`, the hook that never sees the Program) plus the
 * host's own syntactic printing is what lets the adapter drop the reference
 * closure — while the config file, being a host input, stays universal.
 */
export async function test_transformttsc_banner_narrows_the_entry_watch_inputs(): Promise<void> {
  const project = createLinkedPluginProject(["banner"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `a banner-only project must not register the entry's type-only sibling; watched: ${watched.join(", ")}`,
  );
  assert.ok(
    watched.includes(path.resolve(path.join(project.root, "tsconfig.json"))),
    "the config chain stays universal for a file declared complete",
  );
  assert.ok(
    watched.includes(
      path.resolve(path.join(project.root, "banner.config.json")),
    ),
    "the plugin's own config remains a universal host input",
  );
}
