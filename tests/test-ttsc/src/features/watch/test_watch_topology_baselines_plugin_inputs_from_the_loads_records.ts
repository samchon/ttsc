import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a watch session takes each reported plugin input's baseline from the
 * reporting load's record store, and reads the sources without one.
 *
 * WARNING (#1728): the topology read every reported plugin source by content
 * before the first build, although the load proves the same directories from
 * the plugin cache's records a moment later; typia's Go module cost each watch
 * start 0.3-0.6 s. Corrupting only the recorded digest makes the baseline's
 * provenance observable: a baseline taken from the record differs from a
 * content reading of unchanged files.
 *
 * 1. Record the plugin module's digest in a store and corrupt it, then report the
 *    module with that store: the baseline is the record, so a later
 *    notification judged without a store reports a change.
 * 2. Report the module without a store: unchanged sources stay quiet.
 * 3. Report it with a fresh, truthful record and edit a source: the edit moves the
 *    metadata, the module is read again and the change is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual WatchTopology consumes recorded notifications for a real module directory and a real record store; reported plugin changes are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations pluginSourceDigest's selection defines the module bytes; the corrupted literal is the oracle for a record-taken baseline, and the authored edit is the oracle for a changed source.
 * @evidence contracts/testing.md#distinguishing-cases A record-taken baseline, a content baseline over unchanged files, and an edit under a store are separate topologies with separate verdicts.
 * @evidence contracts/testing.md#execution-ownership The named unit owns its copied module, private cache root and recorded watchers; no compiler, Go process or native watcher starts.
 */
export async function test_watch_topology_baselines_plugin_inputs_from_the_loads_records() {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-plugin-records-"),
  );
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "plugincontentidentities_reuses_a_digest_only_while_its_metadata_holds",
      "inputs-1",
    ),
    root,
  );
  const plugin = path.join(root, "plugin");
  for (const parts of [["main.go"], ["internal", "mark", "mark.go"]]) {
    const file = path.join(plugin, ...parts);
    fs.renameSync(`${file}.txt`, file);
  }
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { module: "commonjs", noEmit: true, strict: true },
      include: ["src"],
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    "export const value = 1;\n",
    "utf8",
  );
  const settle = (): void => {
    const past = new Date(Date.now() - 3_600_000);
    for (const file of listFiles(plugin)) fs.utimesSync(file, past, past);
  };
  const cache = path.join(root, "cache");
  const open = (): PluginContentIdentities.Store => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      env: { TTSC_CACHE_DIR: cache },
      sources: [plugin],
    });
    assert.ok(store, "a store opens over the private cache root");
    return store;
  };
  const corrupt = (): void => {
    const directory = path.join(cache, "identities");
    for (const name of fs.readdirSync(directory)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(directory, name);
      const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
        digest: string;
      };
      entry.digest = "0".repeat(64);
      fs.writeFileSync(file, JSON.stringify(entry));
    }
  };
  const failures: unknown[] = [];
  const verify = async (
    name: string,
    run: (session: {
      topology: WatchTopology;
      changes: WatchInputChange[];
      watchers: ReturnType<typeof recordWatchers>["watchers"];
    }) => Promise<void>,
  ): Promise<void> => {
    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
      watchDirectoryThroughFsWatch,
    );
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (_location, error) => {
          throw error;
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      openDirectoryWatch,
      openFileWatch,
      fs.readdirSync,
      () => [path.join(root, "src", "main.ts")],
    );
    try {
      topology.refresh(false);
      await run({ topology, changes, watchers });
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    } finally {
      topology.close();
    }
    if (!watchers.every((watcher) => !watcher.active))
      failures.push(new Error(`${name}: a watcher stayed open`));
  };
  const pluginChanges = (changes: readonly WatchInputChange[]) =>
    changes.filter((change) => change.kind === "plugin");

  settle();
  PluginContentIdentities.sourceDirectory(open(), plugin);
  corrupt();
  await verify(
    "the baseline is the load's record",
    async ({ topology, changes, watchers }) => {
      topology.setExtraInputs([plugin], open());
      await settleWatchEvents();
      changes.length = 0;
      // The same inputs reported by a load without a store: the next state is
      // read from the files, which the corrupted record never matched.
      topology.setExtraInputs([plugin]);
      deliverWatchEvent(watchers, plugin, "change");
      await settleWatchEvents();
      assert.notDeepEqual(pluginChanges(changes), []);
    },
  );
  await verify(
    "without a store unchanged sources stay quiet",
    async ({ topology, changes, watchers }) => {
      topology.setExtraInputs([plugin]);
      await settleWatchEvents();
      changes.length = 0;
      deliverWatchEvent(watchers, plugin, "change");
      await settleWatchEvents();
      assert.deepEqual(pluginChanges(changes), []);
    },
  );
  fs.rmSync(cache, { recursive: true, force: true });
  settle();
  await verify(
    "an edit under a store is read and reported",
    async ({ topology, changes, watchers }) => {
      topology.setExtraInputs([plugin], open());
      await settleWatchEvents();
      changes.length = 0;
      deliverWatchEvent(watchers, plugin, "change");
      await settleWatchEvents();
      assert.deepEqual(pluginChanges(changes), [], "unchanged stays quiet");
      const source = path.join(plugin, "internal", "mark", "mark.go");
      fs.writeFileSync(source, 'package mark\n\nconst Marker = "edited"\n');
      deliverWatchEvent(watchers, source, "change");
      deliverWatchEvent(watchers, path.dirname(source), "change");
      await settleWatchEvents();
      assert.notDeepEqual(pluginChanges(changes), [], JSON.stringify(changes));
    },
  );

  if (failures.length !== 0)
    throw new AggregateError(failures, "watch plugin baseline matrix failed");
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(location) : [location];
  });
}
