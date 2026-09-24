import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies a watch session observes a plugin's Go module as the build reads it:
 * every package of the module, and nothing below a directory the build passes
 * over (samchon/ttsc#1492).
 *
 * The plugin input a load reports is now the plugin's whole module root, which
 * can hold its own `node_modules` and `.git`. The build's digest never reads
 * them (`prunesPluginSourceDirectory`), so a package install or a commit there
 * must not rebuild the session, while an edit to a sibling package of the
 * plugin's own package, or to the module's `go.mod`, must. Windows reports a
 * write inside a directory as a change of that directory's own entry, to the
 * plugin's watch and, inside the project, to its recursive compiler watch, so
 * both must drop the entry of a pruned directory.
 *
 * 1. Watch a project whose plugin module lies below it, with a `node_modules` and
 *    a `.git` of its own, as the load reports it.
 * 2. Write inside both pruned directories, then edit the module's `go.mod` on the
 *    watch that sees their entries, and a sibling package in a subdirectory.
 * 3. Require plugin changes for both edits, and none for a path in or of a pruned
 *    directory, once a quiet period has passed.
 */
export const test_watch_topology_passes_over_what_a_plugin_build_prunes =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-plugin-prune-");
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    const module = path.join(root, "plugin");
    const goMod = path.join(module, "go.mod");
    const sibling = path.join(module, "internal", "mark", "mark.go");
    const pruned = [
      path.join(module, "node_modules"),
      path.join(module, ".git"),
    ];
    write(source, "export const value = 1;\n");
    write(config, JSON.stringify({ files: ["src/main.ts"] }));
    write(goMod, "module example.com/plugin\n\ngo 1.26\n");
    write(path.join(module, "cmd", "plugin", "main.go"), "package main\n");
    write(sibling, "package mark\n");
    for (const directory of pruned) {
      fs.mkdirSync(path.join(directory, "inner"), { recursive: true });
    }

    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      { cwd: root, files: [source], projectRoot: root, tsconfig: config },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
    );
    try {
      // 1. The module root, as the load reports it.
      topology.refresh(false);
      topology.setExtraInputs([module]);

      // 2. Pruned writes first, then the edits that must be heard.
      let round = 0;
      const pollute = (): void => {
        round += 1;
        for (const directory of pruned) {
          write(path.join(directory, "inner", `write-${round}.txt`), "x\n");
          write(path.join(directory, `entry-${round}.txt`), "x\n");
        }
      };
      await waitForPath(changes, goMod, () => {
        pollute();
        fs.appendFileSync(goMod, "// edited\n", "utf8");
      });
      await waitForPath(changes, sibling, () => {
        pollute();
        fs.appendFileSync(sibling, "// edited\n", "utf8");
      });
      await new Promise((resolve) => setTimeout(resolve, 1_000));

      // 3. Both edits are plugin changes; nothing pruned is.
      for (const edited of [goMod, sibling]) {
        assert.ok(
          changes.some(
            (change) => change.kind === "plugin" && change.path === edited,
          ),
          JSON.stringify(changes),
        );
      }
      const leaked = changes.filter(
        (change) =>
          change.kind === "plugin" &&
          change.path !== undefined &&
          pruned.some((directory) => within(directory, change.path!)),
      );
      assert.deepEqual(leaked, [], JSON.stringify(changes));
    } finally {
      topology.close();
    }
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

/**
 * Reapply the stimulus until a change naming `file` is observed.
 *
 * A watcher is armed asynchronously, and macOS starts its FSEvents stream on a
 * separate run loop, so a write in the tick of the registration can land before
 * the stream delivers anything. Repeating the edit proves the contract without
 * waiting on that window, and the deadline still fails when no change comes.
 */
async function waitForPath(
  changes: readonly WatchInputChange[],
  file: string,
  stimulus: () => void,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (!changes.some((change) => change.path === file)) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a change of ${file}: ${JSON.stringify(changes)}`);
    }
    stimulus();
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function within(root: string, location: string): boolean {
  const relative = path.relative(root, location);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}
