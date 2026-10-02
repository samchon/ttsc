import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

const WATCH_EVENT_DEADLINE_MS = 30_000;

/**
 * Verifies inherited output paths retain their declaring configuration base.
 *
 * Actual source config parsing and output inference consume one authored source
 * member. Explicit directory creation events contrast products and external
 * root-relative twins without requesting a compiler or native observer.
 *
 * 1. Declare output and build-info paths in the nested base config.
 * 2. Create the base-relative products and require project-lane quietness.
 * 3. Create each root-relative non-product twin and require a project report.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: inherited path-valued compiler outputs remain relative to the tsconfig that declared them. 1. Declare `outDir` and `tsBuildInfoFile` in a nested base config. 2. Suppress writes at the base config's output paths. 3. Treat the old project-root-relative interpretations as external inputs.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options in a nested base config and the authored base-relative and root-relative paths establish which paths are products and which are external inputs: the base-relative products must stay quiet and each root-relative twin must report as a project change; the expectations are literal, not read from topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Declare `outDir` and `tsBuildInfoFile` in a nested base config. 2. Suppress writes at the base config's output paths. 3. Treat the old project-root-relative interpretations as external inputs.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology consumes the authored absolute compiler member and recorded source-adapter subscriptions. Config inheritance, output inference, project registration and event decisions run unchanged; no compiler process or native observer executes. Original product/non-product expectations and cleanup remain.
 */
export const test_watch_topology_preserves_inherited_output_option_bases =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-inherited-watch-outputs-"),
    );
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
    const observed = recordWatchers(watchDirectoryThroughFsWatch);
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
      observed.openDirectoryWatch,
      observed.openFileWatch,
      fs.readdirSync,
      () => [source],
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
        deliverWatchEvent(observed.watchers, path.dirname(output), "rename");
      }
      await expectProjectQuiet(changes);

      const rootRelativeTwins = [
        path.join(root, "generated", "main.js"),
        path.join(root, "cache", "base.tsbuildinfo"),
      ];
      for (const output of rootRelativeTwins) {
        topology.setProjectInputs({
          root,
          files: [output],
          globs: [],
        });
        const previous = projectChangeCount(changes);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, "{}\n", "utf8");
        deliverWatchEvent(observed.watchers, path.dirname(output), "rename");
        await waitForProjectChange(changes, previous);
      }
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
  assert.equal(projectChangeCount(changes), 0);
}

async function waitForProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
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
