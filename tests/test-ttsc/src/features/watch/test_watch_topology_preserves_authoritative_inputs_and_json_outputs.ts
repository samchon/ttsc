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
 * Verifies predicted products never erase authoritative compiler inputs and
 * every copied compiler product remains excluded from the project-input lane.
 *
 * 1. Keep an explicit declaration input that collides with a predicted output
 *    while the compiler reports its overwrite diagnostic.
 * 2. Preserve `.mjs` and `.cjs` inputs whose paths collide only with an
 *    incorrectly changed extension.
 * 3. Suppress a `resolveJsonModule` copy emitted above the project root.
 */
export const test_watch_topology_preserves_authoritative_inputs_and_json_outputs =
  async (): Promise<void> => {
    await verifyDeclarationInputCollision();
    await verifyJavaScriptExtensionInputs();
    await verifyJsonCopyIsProduct();
  };

async function verifyDeclarationInputCollision(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-authoritative-declaration-input-");
  const source = path.join(root, "src", "foo.ts");
  const declaration = path.join(root, "src", "foo.d.ts");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "export const value = 1;\n");
  fs.writeFileSync(declaration, "export declare const external: 1;\n");
  writeConfig(root, {
    compilerOptions: {
      declaration: true,
      outDir: ".",
      rootDir: ".",
    },
    files: ["src/foo.ts", "src/foo.d.ts"],
  });

  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    fs.writeFileSync(declaration, "export declare const external: 2;\n");
    await waitForCompilerChange(changes, 0, "declaration input collision");
  } finally {
    topology.close();
  }
}

async function verifyJavaScriptExtensionInputs(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-authoritative-javascript-input-");
  const moduleSource = path.join(root, "src", "module.mjs");
  const commonSource = path.join(root, "src", "common.cjs");
  const moduleInput = path.join(root, "dist", "src", "module.js");
  const commonInput = path.join(root, "dist", "src", "common.js");
  for (const input of [moduleSource, commonSource, moduleInput, commonInput]) {
    fs.mkdirSync(path.dirname(input), { recursive: true });
    fs.writeFileSync(input, "export const value = 1;\n");
  }
  writeConfig(root, {
    compilerOptions: {
      allowJs: true,
      checkJs: true,
      outDir: "dist",
      rootDir: ".",
    },
    files: [
      "src/module.mjs",
      "src/common.cjs",
      "dist/src/module.js",
      "dist/src/common.js",
    ],
  });

  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    fs.writeFileSync(moduleInput, "export const value = 2;\n");
    await waitForCompilerChange(changes, 0, ".mjs output extension");
    const previous = compilerChangeCount(changes);
    fs.writeFileSync(commonInput, "export const value = 2;\n");
    await waitForCompilerChange(changes, previous, ".cjs output extension");

    for (const output of [
      path.join(root, "dist", "src", "module.mjs"),
      path.join(root, "dist", "src", "common.cjs"),
    ]) {
      topology.setProjectInputs({ root, files: [output], globs: [] });
      const projectChanges = projectChangeCount(changes);
      fs.writeFileSync(output, "export const value = 2;\n");
      await delay();
      assert.equal(
        projectChangeCount(changes),
        projectChanges,
        `${path.extname(output)} compiler product retriggered the project-input lane`,
      );
    }
  } finally {
    topology.close();
  }
}

async function verifyJsonCopyIsProduct(): Promise<void> {
  const container = TestProject.tmpdir("ttsc-json-copy-product-");
  const root = path.join(container, "project");
  const source = path.join(root, "src", "main.ts");
  const json = path.join(root, "data.json");
  const output = path.join(container, "data.json");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "export const value = 1;\n");
  fs.writeFileSync(json, '{"value":1}\n');
  writeConfig(root, {
    compilerOptions: {
      module: "nodenext",
      outDir: "..",
      resolveJsonModule: true,
    },
    files: ["src/main.ts", "data.json"],
  });

  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    topology.setProjectInputs({ root, files: [output], globs: [] });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, '{"value":2}\n');
    await delay();
    assert.equal(
      projectChangeCount(changes),
      0,
      "copied JSON product retriggered the project-input lane",
    );
  } finally {
    topology.close();
  }
}

function createTopology(
  root: string,
  changes: WatchInputChange[],
): WatchTopology {
  return new WatchTopology(
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
}

function writeConfig(root: string, config: Record<string, unknown>): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(config),
    "utf8",
  );
}

async function waitForCompilerChange(
  changes: readonly WatchInputChange[],
  previous: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (compilerChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(`${label}: compiler input edit was not observed`);
    }
    await delay(25);
  }
}

function compilerChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "compiler").length;
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

function delay(milliseconds = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
