import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies an output directory containing the project cannot erase its compiler
 * watch inputs.
 *
 * Directory-level output exclusion is sound only for a product-only subtree.
 * The project root and its ancestors also contain source files, so applying
 * that exclusion there leaves no per-file watcher on POSIX and no tracked-file
 * match behind the recursive watcher on Windows.
 *
 * 1. Emit into the project root and prove source edits remain live.
 * 2. Emit into the project's parent and prove the same boundary.
 * 3. Put a source inside a descendant output directory and retain it.
 * 4. Keep a product-only output subtree unchanged.
 * 5. Keep the no-emit lane unchanged.
 * 6. In every case, prove a predicted JavaScript product stays quiet.
 */
export const test_watch_topology_keeps_compiler_inputs_when_outdir_contains_project =
  async (): Promise<void> => {
    for (const test of [
      {
        emit: true,
        name: "project root",
        outDir: ".",
        projectInput: (root: string) => path.join(root, "external.json"),
        output: (container: string, root: string) =>
          path.join(root, "src", "main.js"),
      },
      {
        emit: true,
        name: "project ancestor",
        outDir: "..",
        projectInput: (root: string) => path.join(root, "external.json"),
        output: (container: string) => path.join(container, "src", "main.js"),
      },
      {
        emit: true,
        name: "source-overlapping output subtree",
        outDir: "src",
        projectInput: (root: string) => path.join(root, "src", "external.json"),
        output: (_container: string, root: string) =>
          path.join(root, "src", "src", "main.js"),
      },
      {
        emit: true,
        name: "proper output subtree",
        outDir: "dist",
        projectInput: undefined,
        output: (_container: string, root: string) =>
          path.join(root, "dist", "src", "main.js"),
      },
      {
        emit: false,
        name: "no emit",
        outDir: ".",
        projectInput: (root: string) => path.join(root, "external.json"),
        output: (_container: string, root: string) =>
          path.join(root, "src", "main.js"),
      },
    ] as const) {
      const container = TestProject.tmpdir("ttsc-compiler-outdir-watch-");
      const root = path.join(container, "project");
      const source = path.join(root, "src", "main.ts");
      const config = path.join(root, "tsconfig.json");
      fs.mkdirSync(path.dirname(source), { recursive: true });
      fs.writeFileSync(source, "export const value = 1;\n", "utf8");
      fs.writeFileSync(
        config,
        JSON.stringify({
          compilerOptions: {
            outDir: test.outDir,
            rootDir: ".",
          },
          files: ["src/main.ts"],
        }),
        "utf8",
      );
      const projectInput = test.projectInput?.(root);
      if (projectInput !== undefined)
        fs.writeFileSync(projectInput, '{"external":false}\n', "utf8");

      const changes: WatchInputChange[] = [];
      const topology = new WatchTopology(
        {
          cwd: root,
          emit: test.emit,
          files: [],
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
        // fs.watch has no ready event for the macOS FSEvents registration.
        // Let the native backend arm before issuing the event this test must
        // observe; a deadline cannot recover an edit sent before registration.
        await delay(1000);
        fs.writeFileSync(source, "export const value = 2;\n", "utf8");
        await waitForCompilerChange(changes, 0, test.name);
        const previous = await waitForStableCount(
          () => compilerChangeCount(changes),
          test.name,
          "compiler watch lane",
        );

        const output = test.output(container, root);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, "export const value = 2;\n", "utf8");
        await delay();
        assert.equal(
          compilerChangeCount(changes),
          previous,
          `${test.name}: emitted JavaScript retriggered the compiler lane`,
        );

        if (projectInput !== undefined) {
          topology.setProjectInputs({
            root,
            files: [projectInput],
            globs: [],
          });
          const projectChanges = await waitForStableCount(
            () => projectChangeCount(changes),
            test.name,
            "project watch lane",
          );
          fs.writeFileSync(projectInput, '{"external":true}\n', "utf8");
          await waitForProjectChange(changes, projectChanges, test.name);
        }
      } finally {
        topology.close();
      }
    }
  };

async function waitForCompilerChange(
  changes: readonly WatchInputChange[],
  previous: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (compilerChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(`${label}: source edit did not reach compiler watch lane`);
    }
    await delay(25);
  }
}

function compilerChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "compiler").length;
}

async function waitForProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (projectChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(
        `${label}: project input inside source output was not observed`,
      );
    }
    await delay(25);
  }
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

async function waitForStableCount(
  count: () => number,
  label: string,
  lane: string,
): Promise<number> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  let current = count();
  let stableSince = Date.now();
  while (Date.now() - stableSince < 750) {
    if (Date.now() >= deadline)
      assert.fail(`${label}: ${lane} did not reach a quiet boundary`);
    await delay(25);
    const next = count();
    if (next !== current) {
      current = next;
      stableSince = Date.now();
    }
  }
  return current;
}

function delay(milliseconds = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
