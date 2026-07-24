import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies inherited path-valued compiler outputs remain relative to the
 * tsconfig that declared them.
 *
 * 1. Declare `outDir` and `tsBuildInfoFile` in a nested base config.
 * 2. Suppress writes at the base config's output paths.
 * 3. Treat the old project-root-relative interpretations as external inputs.
 */
export const test_watch_topology_preserves_inherited_output_option_bases =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-inherited-watch-outputs-");
    const source = path.join(root, "src", "main.ts");
    const base = path.join(root, "config", "base.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.mkdirSync(path.dirname(base), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(
      base,
      JSON.stringify({
        compilerOptions: {
          composite: true,
          outDir: "generated",
          tsBuildInfoFile: "cache/base.tsbuildinfo",
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        extends: "./config/base.json",
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        emit: true,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
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
      const declaredOutputs = [
        path.join(root, "config", "generated", "main.js"),
        path.join(root, "config", "cache", "base.tsbuildinfo"),
      ];
      topology.setProjectInputs({
        root,
        files: declaredOutputs,
        globs: [],
      });
      for (const output of declaredOutputs) {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, "{}\n", "utf8");
      }
      await expectProjectQuiet(changes);

      const rootRelativeTwins = [
        path.join(root, "generated", "main.js"),
        path.join(root, "cache", "base.tsbuildinfo"),
      ];
      topology.setProjectInputs({
        root,
        files: rootRelativeTwins,
        globs: [],
      });
      const previous = projectChangeCount(changes);
      for (const output of rootRelativeTwins) {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, "{}\n", "utf8");
      }
      await waitForProjectChange(changes, previous);
    } finally {
      topology.close();
    }
  };

async function expectProjectQuiet(
  changes: readonly WatchInputChange[],
): Promise<void> {
  const count = projectChangeCount(changes);
  await delay();
  assert.equal(projectChangeCount(changes), count);
}

async function waitForProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (projectChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a project change after ${previous}`);
    }
    await delay(25);
  }
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

function delay(milliseconds = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
