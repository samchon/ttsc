import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies output suppression follows the effective compiler flags rather than
 * a fixed superset of possible JavaScript, declaration, map, and build-info
 * products.
 *
 * 1. Resolve a positional source relative to the launcher's explicit cwd.
 * 2. Suppress its real adjacent JavaScript but retain a non-emitted `.d.ts`.
 * 3. Suppress the default build-info file even under `noEmit`.
 * 4. Honor CLI declaration-directory overrides.
 */
export const test_watch_topology_models_effective_adjacent_and_incremental_outputs =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-effective-watch-outputs-");
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");

    writeConfig(root, {});
    const adjacentChanges: WatchInputChange[] = [];
    const adjacent = topology(root, adjacentChanges, {
      emit: true,
      files: ["src/main.ts"],
    });
    try {
      adjacent.refresh(false);
      const javascript = path.join(root, "src", "main.js");
      adjacent.setProjectInputs({ root, files: [javascript], globs: [] });
      fs.writeFileSync(javascript, "export const value = 1;\n", "utf8");
      await expectProjectQuiet(adjacentChanges);

      const declaration = path.join(root, "src", "main.d.ts");
      adjacent.setProjectInputs({ root, files: [declaration], globs: [] });
      const previous = projectChangeCount(adjacentChanges);
      fs.writeFileSync(declaration, "export declare const external: 1;\n");
      await waitForProjectChange(adjacentChanges, previous);
    } finally {
      adjacent.close();
    }

    writeConfig(root, { incremental: true, noEmit: true });
    const incrementalChanges: WatchInputChange[] = [];
    const incremental = topology(root, incrementalChanges, {
      emit: false,
      files: [],
    });
    try {
      incremental.refresh(false);
      const buildInfo = path.join(root, "tsconfig.tsbuildinfo");
      incremental.setProjectInputs({ root, files: [buildInfo], globs: [] });
      fs.writeFileSync(buildInfo, "{}\n", "utf8");
      await expectProjectQuiet(incrementalChanges);
    } finally {
      incremental.close();
    }

    writeConfig(root, {});
    const declarationChanges: WatchInputChange[] = [];
    const declaration = topology(root, declarationChanges, {
      emit: true,
      files: [],
      passthrough: ["--declaration", "--declarationDir", "types"],
    });
    try {
      declaration.refresh(false);
      declaration.setProjectInputs({
        root,
        files: [],
        globs: [path.join(root, "types", "**", "*.d.ts")],
      });
      fs.mkdirSync(path.join(root, "types"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "types", "main.d.ts"),
        "export declare const value: 1;\n",
      );
      await expectProjectQuiet(declarationChanges);
    } finally {
      declaration.close();
    }
  };

function topology(
  root: string,
  changes: WatchInputChange[],
  options: {
    emit: boolean;
    files: string[];
    passthrough?: string[];
  },
): WatchTopology {
  return new WatchTopology(
    {
      cwd: root,
      emit: options.emit,
      files: options.files,
      passthrough: options.passthrough,
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
}

function writeConfig(
  root: string,
  compilerOptions: Record<string, unknown>,
): void {
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions,
      files: ["src/main.ts"],
    }),
    "utf8",
  );
}

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
