import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import type { WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { recordWatchers } from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that the CLI topology reports delegated SDK edits through the plugin
 * change lane without listing the compiler or subscribing to SDK files.
 *
 * 1. Publish ordinary source and exact workspace metadata.
 * 2. Edit only the external SDK and retain its baseline through a source-only
 *    publication. Observe one plugin invalidation.
 * 3. Remove the workspace publication, edit again, and verify it stays quiet.
 *
 * @evidence contracts/testing.md#behavioral-verification Real metadata replay observes the edited external file and sends an actual plugin input change, while the listing and native-subscription seams reveal no additional work for the SDK.
 * @evidence contracts/testing.md#independent-expectations The real file edit is the only mutation after initial registration. Its literal path and the known source-only publication determine the expected plugin callback.
 * @evidence contracts/testing.md#distinguishing-cases A source-only publication preserves the SDK observation. An explicit empty workspace retires it while the same plugin source remains.
 * @evidence contracts/testing.md#execution-ownership Uses native temporary files, production polling and the actual topology with recorded native subscriptions and supplied compiler membership. Closes the topology and aborts the callback deadline in finally.
 */
export async function test_watch_topology_observes_delegated_workspace_metadata(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-workspace-project-"),
  );
  const sdk = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-workspace-sdk-"),
  );
  const config = path.join(root, "tsconfig.json");
  const source = path.join(root, "main.ts");
  const plugin = path.join(root, "plugin");
  const tool = path.join(sdk, "go");
  fs.writeFileSync(config, '{"files":["main.ts"]}');
  fs.writeFileSync(source, "export {};");
  fs.mkdirSync(plugin);
  fs.writeFileSync(path.join(plugin, "plugin.go"), "package plugin\n");
  fs.writeFileSync(tool, "delegated executable");
  const witness: PluginBuildEnvironmentWitness.Record = new Map();
  PluginBuildEnvironmentWitness.add(witness, tool);
  const recorded = recordWatchers(watchDirectoryThroughFsWatch);
  const notification = Promise.withResolvers<WatchInputChange>();
  const changes: WatchInputChange[] = [];
  let listings = 0;
  const topology = new WatchTopology(
    { cwd: root, files: [], tsconfig: config },
    {
      onError: (_location, error) => notification.reject(error),
      onInputChange: (change) => {
        changes.push(change);
        notification.resolve(change);
      },
      onTopologyChange: () => undefined,
    },
    recorded.openDirectoryWatch,
    recorded.openFileWatch,
    fs.readdirSync,
    () => {
      ++listings;
      return [source];
    },
  );
  const deadline = new AbortController();
  try {
    topology.refresh(false);
    await topology.whenIdle();
    const before = listings;
    topology.setExtraInputs(
      [plugin],
      undefined,
      PluginBuildEnvironmentWitness.watchInputs([witness], root),
    );
    await topology.whenIdle();
    assert.deepEqual(changes, []);
    const count = recorded.watchers.length;
    fs.appendFileSync(tool, " edited");
    topology.setExtraInputs([plugin]);
    assert.deepEqual(
      await Promise.race([
        notification.promise,
        setTimeout(5000, undefined, { signal: deadline.signal }).then(() => {
          throw new Error("The delegated SDK edit was not observed");
        }),
      ]),
      { kind: "plugin", path: tool },
    );
    assert.equal(listings, before);
    assert.equal(recorded.watchers.length, count);
    topology.setExtraInputs([plugin], undefined, {});
    fs.appendFileSync(tool, " after retirement");
    await setTimeout(450);
    assert.deepEqual(changes, [{ kind: "plugin", path: tool }]);
  } finally {
    deadline.abort();
    topology.close();
  }
}
