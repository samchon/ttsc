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
 * @evidence contracts/testing.md#behavioral-verification Subscription replacement remains transactional: a rejected descendant leaves the ancestor open, successful creation precedes closure, and rejection selects the available parent.
 * @evidence contracts/testing.md#independent-expectations Literal event order, exact map keys, explicit thrown watch rejection and an independently resolved parent path establish replacement and fallback outcomes.
 * @evidence contracts/testing.md#distinguishing-cases Rejected and successful replacement, handle closure order and rejected-root fallback retain every original assertion.
 * @evidence contracts/testing.md#execution-ownership The named src/features/watch entry calls authored policy and resource-reconciliation functions directly over private path fixtures and owned callbacks; no compiler refresh, native event scheduler, product host or build executes.
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
