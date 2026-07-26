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
        output: (container: string, root: string) =>
          path.join(root, "src", "main.js"),
      },
      {
        emit: true,
        name: "project ancestor",
        outDir: "..",
        output: (container: string) => path.join(container, "src", "main.js"),
      },
      {
        emit: true,
        name: "source-overlapping output subtree",
        outDir: "src",
        output: (_container: string, root: string) =>
          path.join(root, "src", "src", "main.js"),
      },
      {
        emit: true,
        name: "proper output subtree",
        outDir: "dist",
        output: (_container: string, root: string) =>
          path.join(root, "dist", "src", "main.js"),
      },
      {
        emit: false,
        name: "no emit",
        outDir: ".",
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
        fs.writeFileSync(source, "export const value = 2;\n", "utf8");
        await waitForCompilerChange(changes, 0, test.name);

        const output = test.output(container, root);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        const previous = compilerChangeCount(changes);
        fs.writeFileSync(output, "export const value = 2;\n", "utf8");
        await delay();
        assert.equal(
          compilerChangeCount(changes),
          previous,
          `${test.name}: emitted JavaScript retriggered the compiler lane`,
        );
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

function delay(milliseconds = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
