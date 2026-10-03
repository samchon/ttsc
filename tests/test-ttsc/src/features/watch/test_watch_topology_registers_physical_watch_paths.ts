import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies physical subscription arguments and declared positional callbacks.
 *
 * 1. Author a real directory alias and a source declared through that alias.
 * 2. Assert recorded backend arguments use the physical source directory.
 * 3. Deliver its changed bytes and require the original declared source path.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source WatchTopology and directory adapter register physical paths and reconstruct a lexical source callback from a supplied observer event.
 * @evidence contracts/testing.md#independent-expectations Authored physical and alias roots establish the independently expected registration and report paths; a throwing compiler reader pins the positional branch.
 * @evidence contracts/testing.md#distinguishing-cases Physical subscription spelling and lexical report spelling differ under an independently checked native directory alias. Alias preparation must succeed; its failure is not product behavior or successful coverage. This unit does not observe OS delivery.
 * @evidence contracts/testing.md#execution-ownership This source unit executes actual path planning and callback classification through recorded subscriptions, with no compiler process or native observer.
 */
export const test_watch_topology_registers_physical_watch_paths =
  async (): Promise<void> => {
    const physicalRoot = TestProject.tmpdir("ttsc-watch-physical-");
    const aliasParent = TestProject.tmpdir("ttsc-watch-alias-");
    const root = path.join(aliasParent, "project");
    fs.symlinkSync(
      physicalRoot,
      root,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(fs.lstatSync(root).isSymbolicLink(), true);
    const physical = fs.realpathSync.native?.(root) ?? fs.realpathSync(root);
    assert.equal(physical, fs.realpathSync.native(physicalRoot));
    assert.notEqual(physical, path.resolve(root));

    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    const config = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { noEmit: true },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
      watchDirectoryThroughFsWatch,
    );
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      openDirectoryWatch,
      openFileWatch,
      fs.readdirSync,
      () => {
        assert.fail("positional inputs must not query compiler membership");
      },
    );
    try {
      topology.refresh(false);
      // Only paths this class resolved from an event are in scope. A config
      // path arrives already canonicalized from the project reader, which owns
      // that normalization and is not what this case is about, so the wait ends
      // on a source change rather than on any change at all.
      const sourceChanges = (): string[] =>
        changes
          .map((change) => change.path)
          .filter((location): location is string => location !== undefined)
          .filter((location) => path.basename(location) === "main.ts");
      const physicalSource = path.join(physical, "src", "main.ts");
      const physicalDirectory = path.dirname(physicalSource);
      assert.ok(
        watchers.some((watcher) => watcher.location === physicalDirectory),
        "the source directory must register under its physical spelling",
      );
      assert.equal(
        watchers.some((watcher) =>
          watcher.location.startsWith(`${root}${path.sep}`),
        ),
        false,
        "an aliased spelling must not reach the observer backend",
      );
      fs.writeFileSync(source, "export const value = 2;\n", "utf8");
      deliverWatchEvent(watchers, physicalSource, "change");
      await settleWatchEvents();
      assert.notEqual(sourceChanges().length, 0);
      const reported = sourceChanges();
      assert.equal(
        reported.every((location) => location === source),
        true,
        `declared spelling expected, got ${JSON.stringify(reported)}`,
      );
      assert.deepEqual(changes, [{ kind: "compiler", path: source }]);
    } finally {
      topology.close();
      assert.ok(watchers.every((watcher) => watcher.active === false));
    }
  };
