import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies a failed topology refresh still schedules the resident config lane.
 *
 * 1. Delete the active config and observe a config change despite parse failure.
 * 2. Recreate it and prove the same watch session observes the replacement.
 */
export const test_watch_topology_reports_deleted_config_and_recreation =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-config-recovery-");
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    const configText = JSON.stringify({ files: ["src/main.ts"] });
    fs.writeFileSync(config, configText, "utf8");

    const changes: WatchInputChange[] = [];
    const errors: unknown[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (_location, error) => errors.push(error),
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
    );
    try {
      topology.refresh(false);
      topology.beginExecutionGeneration();
      fs.rmSync(config);
      await waitFor(
        () => changes.some((change) => change.kind === "config"),
        "config deletion",
      );
      assert.ok(errors.length > 0, "the failed refresh must remain observable");

      const deletionCount = changes.filter(
        (change) => change.kind === "config",
      ).length;
      fs.writeFileSync(config, configText, "utf8");
      await waitFor(
        () =>
          changes.filter((change) => change.kind === "config").length >
          deletionCount,
        "config recreation",
      );
    } finally {
      topology.close();
    }
  };

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`timed out waiting for ${label}`);
}
