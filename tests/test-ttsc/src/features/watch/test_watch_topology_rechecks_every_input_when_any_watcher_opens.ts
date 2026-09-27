import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import {
  recordWatchers,
  settleWatchEvents,
} from "../../internal/recorded-watchers";

/**
 * Verifies a change no watcher reported is found once any watcher of the
 * session opens, whatever kind of input the opening watcher observes.
 *
 * On macOS every directory watch of a process shares one FSEventStream, which
 * libuv re-creates whenever any watch opens or closes, and the re-created
 * stream reports nothing from before it started. So an edit to a project input
 * can be lost while a plugin source's watcher opens, and `ttsc --watch` stayed
 * idle with the edit unbuilt (samchon/ttsc#1583). The topology re-checked the
 * inputs of a kind only when a watcher of that kind opened. It now re-checks
 * every kind once the backend settles after any watcher opens or closes.
 *
 * 1. Resolve a project that publishes `docs/spec.md` as a project input, with
 *    watchers that record their listeners instead of watching.
 * 2. Edit `docs/spec.md` and deliver nothing, as the gap in a re-created stream
 *    leaves it.
 * 3. Report a plugin source directory, which opens watchers of another kind, and
 *    assert the edit to `docs/spec.md` is reported.
 */
export const test_watch_topology_rechecks_every_input_when_any_watcher_opens =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-delivery-recheck-"),
    );
    const spec = path.join(root, "docs", "spec.md");
    const plugin = path.join(root, "plugin-go");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.dirname(spec), { recursive: true });
    fs.mkdirSync(plugin, { recursive: true });
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
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");

    const { restore } = recordWatchers();
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
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({ files: [spec], globs: [], root });
      await settleWatchEvents();
      changes.length = 0;

      fs.writeFileSync(spec, "broken\n", "utf8");
      topology.setExtraInputs([plugin]);
      await settleWatchEvents();
      assert.ok(
        changes.some(
          (change) => change.kind === "project" && change.path === spec,
        ),
        `an edit no watcher reported was not found when another watcher opened: ${JSON.stringify(changes)}`,
      );
    } finally {
      topology.close();
      restore();
    }
  };
