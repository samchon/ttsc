import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  projectInputActiveWatchDirectories,
  projectInputWatchDirectories,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies an external declaration never anchors above the project.
 *
 * An external input anchors on its declared parent so a tree that does not
 * exist yet is still observed and so siblings share one handle. Rising is only
 * safe while the anchor stays beside the project. An anchor that contains the
 * project outranks the project's own root once the roots are merged, and then
 * every in-project declaration rides a single recursive handle over a shared
 * system directory — the temp root, or the filesystem root. Such a handle
 * delivers nothing in practice, so the declarations that were supposed to be
 * covered go silent while the build keeps succeeding.
 *
 * 1. Anchor a sibling external tree and keep the parent rule.
 * 2. Anchor one whose parent contains the project and require a narrower root.
 * 3. Assert the project's own root survives the merge in both cases.
 */
export const test_project_input_watch_root_never_swallows_the_project =
  (): void => {
    const parent = TestProject.tmpdir("ttsc-project-input-anchor-");
    const root = path.join(parent, "project");
    const sibling = path.join(parent, "external", "docs");
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(sibling, { recursive: true });

    assert.deepEqual(
      projectInputWatchDirectories(sibling, root),
      [path.join(parent, "external")],
      "a sibling external tree keeps the declared-parent anchor",
    );

    // Declared directly under the directory that holds the project, so the
    // parent rule would rise to a directory containing the project itself.
    const beside = path.join(parent, "selection");
    fs.mkdirSync(beside, { recursive: true });
    assert.deepEqual(
      projectInputWatchDirectories(beside, root),
      [beside],
      "an anchor that would contain the project falls back to its own tree",
    );

    assert.deepEqual(
      projectInputActiveWatchDirectories([
        ...projectInputWatchDirectories(beside, root),
        ...projectInputWatchDirectories(path.join(root, "docs"), root),
      ]),
      [beside, root],
      "the project's own root must survive beside an external anchor",
    );
  };
