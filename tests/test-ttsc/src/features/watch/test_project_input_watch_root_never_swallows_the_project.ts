import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectInputActiveWatchDirectories } from "../../../../../packages/ttsc/src/launcher/internal/watch/projectInputActiveWatchDirectories";
import { projectInputWatchDirectories } from "../../../../../packages/ttsc/src/launcher/internal/watch/projectInputWatchDirectories";

/**
 * Verifies an external declaration never anchors above the project.
 *
 * An external input anchors on its declared parent so a tree that does not
 * exist yet is still observed and so siblings share one handle. Rising is only
 * safe while the anchor stays beside the project. An anchor that contains the
 * project outranks the project's own root once the roots are merged, and then
 * in-project declarations lose their distinct project-root selection in favor
 * of a shared ancestor. This unit observes the selected roots, not whether a
 * native ancestor watcher delivers particular events.
 *
 * 1. Anchor a sibling external tree and keep the parent rule.
 * 2. Anchor one whose parent contains the project and require a narrower root.
 * 3. Decline entirely when even the target's own tree contains the project.
 * 4. Assert the project's own root survives the merge beside an external one.
 *
 * @evidence contracts/testing.md#behavioral-verification projectInputWatchDirectories and projectInputActiveWatchDirectories preserve the project root while narrowing or rejecting external anchors.
 * @evidence contracts/testing.md#independent-expectations an external recursive anchor may not contain the project and displace its own coverage.
 * @evidence contracts/testing.md#distinguishing-cases a safe sibling keeps its parent anchor, a beside-project target narrows to itself, a containing target is rejected and active merging retains the project root.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/watch; it calls the actual root selectors with default identity over TestProject-owned directories. Nearest-existing-directory and native identity/case observations may include read-only Windows fsutil for an empty ancestor; no watcher, compiler or product host starts. Literal selected roots do not certify actual kernel coverage.
 */
export function test_project_input_watch_root_never_swallows_the_project(): void {
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

    // The case the runner actually hit: a resolution ancestor published as a
    // declaration. Every candidate for it contains the project, so there is no
    // root left that would not swallow the project, and declining is the whole
    // point of the rule.
    assert.deepEqual(
      projectInputWatchDirectories(parent, root),
      [],
      "a declaration containing the project leaves nothing safe to watch",
    );

    assert.deepEqual(
      projectInputActiveWatchDirectories([
        ...projectInputWatchDirectories(beside, root),
        ...projectInputWatchDirectories(path.join(root, "docs"), root),
      ]),
      [beside, root],
      "the project's own root must survive beside an external anchor",
    );
  }
