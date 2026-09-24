import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies a watch session reports what a directory created below a plugin
 * module holds once it starts watching it, so a file written there during the
 * rebuild the directory's creation started is not lost (samchon/ttsc#1500).
 *
 * The session watches each directory of a plugin module on its own, and adds a
 * new directory's watcher only when the topology refreshes after a build. On
 * Linux and macOS a watcher reports its directory's direct entries alone, so a
 * file written into the new directory before that refresh reached no watcher,
 * and the session kept the binary the rebuild had built without it. Windows
 * reports such a write as a change of the directory's entry to its parent, so
 * the scenario passes there either way; Linux CI is where it fails without the
 * report.
 *
 * 1. Watch a plugin module outside the project, as the load reports it, and wait
 *    until an edit in it is heard.
 * 2. Create a package directory, then write a file and a `node_modules` below it
 *    before refreshing, as a save during the rebuild would.
 * 3. Refresh, as the session does after the build, and require a plugin change for
 *    the file and none for anything below `node_modules`.
 * 4. Start a second session on the same module, refresh it twice, and require no
 *    change at all: directories watched from a session's start are read by its
 *    first build.
 */
export const test_watch_topology_reports_what_a_new_plugin_directory_holds =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-plugin-new-directory-");
    const project = path.join(root, "project");
    const source = path.join(project, "src", "main.ts");
    const config = path.join(project, "tsconfig.json");
    const plugin = path.join(root, "plugin");
    const mark = path.join(plugin, "internal", "mark", "mark.go");
    write(source, "export const value = 1;\n");
    write(config, JSON.stringify({ files: ["src/main.ts"] }));
    write(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    write(mark, "package mark\n");

    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      { cwd: project, files: [source], projectRoot: project, tsconfig: config },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
    );
    try {
      // 1. The module, as the load reports it before its build.
      topology.refresh(false);
      topology.setExtraInputs([plugin]);
      await waitForPath(changes, mark, () =>
        fs.appendFileSync(mark, "// probe\n"),
      );

      // 2. A new package, and what lands in it before the refresh.
      const created = path.join(plugin, "internal", "newpkg");
      fs.mkdirSync(created);
      await waitForPath(changes, created, () => undefined);
      const file = path.join(created, "x.go");
      const pruned = path.join(created, "node_modules", "pkg");
      write(file, "package newpkg\n");
      write(path.join(pruned, "index.js"), "module.exports = 1;\n");

      // 3. The refresh after the build reports what the directory holds.
      const before = changes.length;
      topology.refresh(true);
      await waitForPath(changes, file, () => undefined);
      assert.deepEqual(
        changes
          .slice(before)
          .filter(
            (change) =>
              change.kind === "plugin" &&
              change.path !== undefined &&
              within(path.join(created, "node_modules"), change.path),
          ),
        [],
        "nothing below a directory the build passes over is reported",
      );
    } finally {
      topology.close();
    }

    // 4. A session that starts on the module, and refreshes with nothing new,
    // reports nothing: its build reads what the directories hold.
    const quiet: WatchInputChange[] = [];
    const fresh = new WatchTopology(
      { cwd: project, files: [source], projectRoot: project, tsconfig: config },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => quiet.push(change),
        onTopologyChange: () => undefined,
      },
    );
    try {
      fresh.refresh(false);
      fresh.setExtraInputs([plugin]);
      fresh.refresh(true);
      fresh.refresh(true);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      assert.deepEqual(
        quiet,
        [],
        "directories watched from the session's start report nothing",
      );
    } finally {
      fresh.close();
    }
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

/**
 * Apply the stimulus until a change naming `file` is observed, bounded by the
 * shared event deadline.
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
