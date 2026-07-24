import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies watch topology preserves case-sensitive project inputs.
 *
 * Lowercasing Windows paths can collapse two physical roots before watcher
 * pruning and can make a glob match its case-distinct sibling. Both exact and
 * glob inputs must retain the identities reported by the filesystem.
 *
 * 1. Create case-distinct external roots and glob roots.
 * 2. Assert both recursive watcher handles remain live.
 * 3. Observe each exact and glob input, then remove one glob and keep it quiet.
 */
export const test_watch_topology_preserves_case_sensitive_project_inputs =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-case-project-");
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          outDir: "dist",
          rootDir: "src",
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const external = TestProject.tmpdir("ttsc-project-input-case-external-");
    enableWindowsCaseSensitivity(external);
    const upperRoot = path.join(external, "Project");
    const lowerRoot = path.join(external, "project");
    fs.mkdirSync(upperRoot);
    try {
      fs.mkdirSync(lowerRoot);
    } catch {
      return;
    }
    if (realpath(upperRoot) === realpath(lowerRoot)) return;
    const upperApi = path.join(upperRoot, "Api");
    const lowerApi = path.join(upperRoot, "api");
    fs.mkdirSync(upperApi);
    try {
      fs.mkdirSync(lowerApi);
    } catch {
      return;
    }
    if (realpath(upperApi) === realpath(lowerApi)) return;

    const upperExact = path.join(upperRoot, "nested", "evidence.md");
    const lowerExact = path.join(lowerRoot, "nested", "evidence.md");
    const upperGlob = path.join(upperApi, "**", "*.json");
    const lowerGlob = path.join(lowerApi, "**", "*.json");
    const changes: WatchInputChange[] = [];
    let liveRoots: readonly string[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onProjectInputWatchRoots: (roots) => {
          liveRoots = [...roots];
        },
        onTopologyChange: () => {
          throw new Error("external inputs must not alter compiler membership");
        },
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [upperExact, lowerExact],
        globs: [upperGlob, lowerGlob],
      });
      assert.deepEqual(
        liveRoots,
        [realpath(upperRoot), realpath(lowerRoot)].sort(),
      );

      await writeAndWait(changes, upperExact, "upper\n");
      await writeAndWait(changes, lowerExact, "lower\n");
      const upperJson = path.join(upperApi, "openapi.json");
      const lowerJson = path.join(lowerApi, "openapi.json");
      await writeAndWait(changes, upperJson, "{}\n");
      await writeAndWait(changes, lowerJson, "{}\n");

      topology.setProjectInputs({
        root,
        files: [upperExact, lowerExact],
        globs: [upperGlob],
      });
      const count = changes.length;
      fs.writeFileSync(lowerJson, '{"removed":true}\n', "utf8");
      await delay();
      assert.equal(changes.length, count, JSON.stringify(changes.slice(count)));
    } finally {
      topology.close();
    }
  };

async function writeAndWait(
  changes: readonly WatchInputChange[],
  location: string,
  content: string,
): Promise<void> {
  const count = changes.length;
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, content, "utf8");
  const deadline = Date.now() + 5_000;
  while (changes.length === count) {
    if (Date.now() >= deadline) {
      assert.fail(`expected project change for ${location}`);
    }
    await delay(25);
  }
  await delay();
  assert.equal(changes.at(-1)?.kind, "project");
}

function enableWindowsCaseSensitivity(directory: string): void {
  if (process.platform !== "win32") return;
  childProcess.spawnSync(
    "fsutil.exe",
    ["file", "setCaseSensitiveInfo", directory, "enable"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
