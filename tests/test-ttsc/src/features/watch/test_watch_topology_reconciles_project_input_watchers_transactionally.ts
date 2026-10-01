import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createProjectInputPathIdentityContext";
import { projectInputAvailableWatchDirectory } from "../../../../../packages/ttsc/src/launcher/internal/watch/projectInputAvailableWatchDirectory";
import { syncWatchers } from "../../../../../packages/ttsc/src/launcher/internal/watch/syncWatchers";

/**
 * Verifies project-input watcher reconciliation is transactional.
 *
 * A newly promoted descendant can reject `fs.watch` while its recursive
 * ancestor is still the only live coverage. The old handle must remain until a
 * replacement exists, and the retry must fall back to that working ancestor.
 *
 * 1. Reject descendant creation and assert the ancestor stays open.
 * 2. Retry successfully and assert creation precedes ancestor closure.
 * 3. Reject the descendant root and assert retry selection falls back upward.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls syncWatchers with a fake watcher map and a creator that first throws then succeeds, asserting the ancestor stays open and in the map after the failure, "create descendant" precedes "close ancestor" after success, and the result flags; then calls projectInputAvailableWatchDirectory with a rejected descendant and asserts it returns the existing parent.
 * @evidence contracts/testing.md#independent-expectations The expected event order, map keys and boolean results are authored literals from the transactional contract (create before close, keep on failure), and the fallback directory is the parent created in the test and resolved with fs.realpathSync.native rather than computed by the function.
 * @evidence contracts/testing.md#distinguishing-cases A failed creation (returns false, ancestor kept, one error) is contrasted with a successful one (returns true, create then close, only the descendant left), and a rejected descendant directory falls back to its ancestor. A root with no existing parent or a project-root ceiling is not covered.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/watch; it calls syncWatchers (fake watcher objects) and projectInputAvailableWatchDirectory (real directories in a TestProject.tmpdir), not WatchTopology itself, and opens no watcher or process.
 */
export function test_watch_topology_reconciles_project_input_watchers_transactionally() {
    const events: string[] = [];
    const errors: unknown[] = [];
    const watchers = new Map<string, FakeWatcher>([
      [
        "ancestor",
        new FakeWatcher(() => {
          events.push("close ancestor");
        }),
      ],
    ]);
    const desired = new Map([["descendant", "descendant"]]);

    assert.equal(
      syncWatchers(
        watchers,
        desired,
        () => {
          events.push("create descendant");
          throw new Error("watch rejected");
        },
        (_location, error) => errors.push(error),
      ),
      false,
    );
    assert.deepEqual([...watchers.keys()], ["ancestor"]);
    assert.deepEqual(events, ["create descendant"]);
    assert.equal(errors.length, 1);

    events.length = 0;
    assert.equal(
      syncWatchers(
        watchers,
        desired,
        () => {
          events.push("create descendant");
          return new FakeWatcher(() => {
            events.push("close descendant");
          });
        },
        (_location, error) => errors.push(error),
      ),
      true,
    );
    assert.deepEqual(events, ["create descendant", "close ancestor"]);
    assert.deepEqual([...watchers.keys()], ["descendant"]);

    const root = TestProject.tmpdir("ttsc-project-input-watch-rollback-");
    const ancestor = path.join(root, "ancestor");
    const descendant = path.join(ancestor, "descendant");
    fs.mkdirSync(descendant, { recursive: true });
    const identities = createProjectInputPathIdentityContext();
    const rejected = new Set([identities.resolve(descendant).key]);
    assert.equal(
      projectInputAvailableWatchDirectory(descendant, rejected, identities),
      realpath(ancestor),
    );
}

class FakeWatcher {
  public constructor(private readonly onClose: () => void) {}

  public close(): void {
    this.onClose();
  }

  public on(_event: "error", _listener: (error: Error) => void): FakeWatcher {
    return this;
  }
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}
