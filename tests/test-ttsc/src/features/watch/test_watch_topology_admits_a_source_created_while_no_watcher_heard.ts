import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import {
  recordWatchers,
  settleWatchEvents,
} from "../../internal/recorded-watchers";

/**
 * Verifies a source created in a watched directory while no watcher heard it
 * joins the program once the session re-checks its inputs.
 *
 * On macOS a file created while libuv re-creates the FSEventStream is heard by
 * no watcher (samchon/ttsc#1583). The re-check after a directory watch opened
 * compared the files already in the program and resolved membership only when a
 * compiler directory's own watcher opened, so a source included by `include:
 * ["src"]` and created in the gap stayed out of the program until another
 * change rebuilt it. The re-check now resolves membership again when a watched
 * directory's entries moved since the last resolution.
 *
 * 1. Resolve a project that includes `src`, with watchers that record their
 *    listeners instead of watching.
 * 2. Create `src/extra.ts` and deliver nothing.
 * 3. Open a project-input directory watch, which schedules the re-check.
 * 4. Assert the topology reports its membership changed.
 */
export const test_watch_topology_admits_a_source_created_while_no_watcher_heard =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-gap-source-"),
    );
    const spec = path.join(root, "docs", "spec.md");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.dirname(spec), { recursive: true });
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
    fs.writeFileSync(spec, "# Contract\n", "utf8");

    const { restore } = recordWatchers();
    let topologyChanges = 0;
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
        onInputChange: () => undefined,
        onTopologyChange: () => {
          topologyChanges += 1;
        },
      },
    );
    try {
      topology.refresh(false);
      await settleWatchEvents();
      topologyChanges = 0;

      fs.writeFileSync(
        path.join(root, "src", "extra.ts"),
        "export const extra = 2;\n",
        "utf8",
      );
      topology.setProjectInputs({ files: [spec], globs: [], root });
      await settleWatchEvents();
      assert.notEqual(
        topologyChanges,
        0,
        "a source created while no watcher heard it did not join the program",
      );
    } finally {
      topology.close();
      restore();
    }
  };
