import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
  projectInputReloadEventShouldNotify,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies reload project inputs dominate the ordinary external-data lane.
 *
 * A lint config remains in `files` for old/LSP decoders, but CLI watch must
 * replace plugin selection whenever that same exact path changes. The retained
 * ancestor watcher must preserve the classification across every filesystem
 * lifecycle, including events that do not name the changed file.
 *
 * 1. Create, edit, delete, and atomically replace one initially missing reload.
 * 2. Require only cold config events for the duplicated files/reloadFiles path.
 * 3. Keep an ordinary project file warm and classify filename-less deltas.
 */
export const test_watch_topology_treats_reload_project_inputs_as_cold_transitions =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-reload-");
    const source = path.join(root, "src", "main.ts");
    const tsconfig = path.join(root, "tsconfig.json");
    const reloadFile = path.join(root, "config", "lint.config.json");
    const warmFile = path.join(root, "docs", "spec.md");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.mkdirSync(path.dirname(warmFile), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(warmFile, "initial\n", "utf8");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({ files: ["src/main.ts"] }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        projectRoot: root,
        tsconfig,
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [reloadFile, warmFile],
        globs: [],
        reloadFiles: [reloadFile],
      });
      await delay();

      fs.mkdirSync(path.dirname(reloadFile), { recursive: true });
      await expectNextKind(changes, "config", () =>
        fs.writeFileSync(reloadFile, '{"rules":{}}\n', "utf8"),
      );
      await expectNextKind(changes, "config", () =>
        fs.writeFileSync(reloadFile, '{"rules":{"no-var":"error"}}\n', "utf8"),
      );
      await expectNextKind(changes, "config", () => fs.rmSync(reloadFile));

      const replacement = path.join(root, "config", "lint.config.next.json");
      fs.writeFileSync(replacement, '{"rules":{"eqeqeq":"error"}}\n', "utf8");
      await delay();
      await expectNextKind(changes, "config", () =>
        fs.renameSync(replacement, reloadFile),
      );

      await expectNextKind(changes, "project", () =>
        fs.writeFileSync(warmFile, "warm edit\n", "utf8"),
      );
      assert.equal(
        changes.some(
          (change) =>
            change.kind === "project" &&
            change.path !== undefined &&
            path.resolve(change.path) === path.resolve(reloadFile),
        ),
        false,
        JSON.stringify(changes),
      );

      assert.equal(
        projectInputReloadEventShouldNotify({
          changedInputs: [reloadFile],
          reloadFiles: [reloadFile],
        }),
        true,
        "a filename-less fingerprint delta must select the cold lane",
      );
      assert.equal(
        projectInputReloadEventShouldNotify({
          changedInputs: [warmFile],
          reloadFiles: [reloadFile],
        }),
        false,
        "a filename-less warm-data delta must remain a project event",
      );
      assert.equal(
        projectInputReloadEventShouldNotify({
          changed: reloadFile,
          changedInputs: [],
          reloadFiles: [reloadFile],
        }),
        true,
        "a named reload event stays cold even when bytes are unchanged",
      );
    } finally {
      topology.close();
    }
  };

async function expectNextKind(
  changes: readonly WatchInputChange[],
  kind: WatchInputChange["kind"],
  mutate: () => void,
): Promise<void> {
  const previous = changes.filter((change) => change.kind === kind).length;
  mutate();
  const deadline = Date.now() + 5_000;
  while (changes.filter((change) => change.kind === kind).length === previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected ${kind}: ${JSON.stringify(changes)}`);
    }
    await delay(25);
  }
  await delay();
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
