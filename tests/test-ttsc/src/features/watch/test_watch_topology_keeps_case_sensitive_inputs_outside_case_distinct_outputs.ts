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
 * Verifies case-distinct compiler outputs do not hide project inputs.
 *
 * Compiler topology keeps ordinary Windows path keys case-insensitive, but a
 * project rule can declare a physical sibling under a case-sensitive directory.
 * Output exclusion must compare those declarations by filesystem identity.
 *
 * 1. Put declaration output in `Output` and project inputs in sibling `output`.
 * 2. Put build-info output at `State.json` and input at sibling `state.json`.
 * 3. Assert both project-input watcher roots remain live.
 * 4. Create exact and glob members and observe every project change.
 */
export const test_watch_topology_keeps_case_sensitive_inputs_outside_case_distinct_outputs =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-output-project-");
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");

    const external = TestProject.tmpdir("ttsc-project-input-output-external-");
    if (enableWindowsCaseSensitivity(external) === false) return;
    const outputRoot = path.join(external, "Output");
    const inputRoot = path.join(external, "output");
    fs.mkdirSync(outputRoot);
    if (createCaseDistinctDirectory(inputRoot) === false) return;
    assert.notEqual(realpath(outputRoot), realpath(inputRoot));
    const exactRoot = path.join(external, "Exact");
    const exactOutput = path.join(exactRoot, "nested", "State.json");
    const exactInput = path.join(exactRoot, "nested", "state.json");
    fs.mkdirSync(exactRoot);
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          declaration: true,
          declarationDir: outputRoot,
          incremental: true,
          rootDir: "src",
          tsBuildInfoFile: exactOutput,
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const exact = path.join(inputRoot, "nested", "evidence.md");
    const globRoot = path.join(inputRoot, "api");
    fs.mkdirSync(globRoot);
    const changes: WatchInputChange[] = [];
    let liveRoots: readonly string[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
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
        onTopologyChange: () => undefined,
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [exact, exactInput],
        globs: [path.join(globRoot, "**", "*.json")],
      });
      assert.deepEqual(
        liveRoots,
        [realpath(exactRoot), realpath(inputRoot)].sort(),
      );

      await writeAndWait(changes, exact, "exact\n");
      await writeAndWait(changes, exactInput, "case-distinct output\n");
      await writeAndWait(changes, path.join(globRoot, "openapi.json"), "{}\n");
    } finally {
      topology.close();
    }
  };

async function writeAndWait(
  changes: readonly WatchInputChange[],
  location: string,
  content: string,
): Promise<void> {
  const count = projectChangeCount(changes);
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, content, "utf8");
  const deadline = Date.now() + 5_000;
  while (projectChangeCount(changes) === count) {
    if (Date.now() >= deadline) {
      assert.fail(`expected project change for ${location}`);
    }
    await delay(25);
  }
  await delay();
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

function enableWindowsCaseSensitivity(directory: string): boolean {
  if (process.platform !== "win32") return true;
  const result = childProcess.spawnSync(
    "fsutil.exe",
    ["file", "setCaseSensitiveInfo", directory, "enable"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  return result.status === 0;
}

function createCaseDistinctDirectory(directory: string): boolean {
  try {
    fs.mkdirSync(directory);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
