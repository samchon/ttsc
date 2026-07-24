import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/lib/internal/projectInputPathIdentity.js";
import {
  projectInputAvailableWatchDirectory,
  syncWatchers,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

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
 */
export const test_watch_topology_reconciles_project_input_watchers_transactionally =
  (): void => {
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
  };

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
