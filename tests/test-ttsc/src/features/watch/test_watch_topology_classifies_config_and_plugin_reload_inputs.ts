import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies config and selected plugin sources enter the same reload lane.
 *
 * The watch launcher resets resident state for either change kind. This test
 * owns the topology half of that contract; the resident lifecycle test drives
 * the config kind through the shared reset branch and observes a fresh PID.
 *
 * 1. Watch one project config and one selected plugin source tree.
 * 2. Edit each input and require its precise change kind.
 * 3. Prove both edits stay distinct from compiler/project changes.
 */
export const test_watch_topology_classifies_config_and_plugin_reload_inputs =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-reload-inputs-");
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    const pluginRoot = path.join(root, "plugin");
    const pluginSource = path.join(pluginRoot, "rule.go");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.mkdirSync(pluginRoot);
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(pluginSource, "package plugin\n", "utf8");
    writeConfig(config, false);

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
    );
    try {
      topology.refresh(false);
      topology.setExtraInputs([pluginRoot]);

      writeConfig(config, true);
      await waitForKind(changes, "config");
      fs.writeFileSync(pluginSource, "package plugin\n\n// changed\n", "utf8");
      await waitForKind(changes, "plugin");

      assert.equal(
        changes.every(
          (change) => change.kind === "config" || change.kind === "plugin",
        ),
        true,
        JSON.stringify(changes),
      );
    } finally {
      topology.close();
    }
  };

function writeConfig(location: string, noUnusedLocals: boolean): void {
  fs.writeFileSync(
    location,
    JSON.stringify({
      compilerOptions: { noUnusedLocals },
      files: ["src/main.ts"],
    }),
    "utf8",
  );
}

async function waitForKind(
  changes: readonly WatchInputChange[],
  kind: WatchInputChange["kind"],
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!changes.some((change) => change.kind === kind)) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a ${kind} change: ${JSON.stringify(changes)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
