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
 * 3. Suppress nested products emitted above the project without `rootDir`.
 * 4. Treat removed `outFile` as a diagnostic, not an output-layout contract.
 * 5. Resolve launcher and passthrough output paths from the compiler's cwd.
 * 6. Suppress TS/JS diagnostic-recovery products outside the mapping root, while
 *    retaining an adjacent JSON negative twin.
 */
export const test_watch_topology_preserves_authoritative_inputs_and_json_outputs =
  async (): Promise<void> => {
    await verifyDeclarationInputCollision();
    await verifyJavaScriptExtensionInputs();
    await verifyJsonCopyIsProduct();
    await verifyRemovedOutFileLayout();
    await verifyPassthroughPathsUseProjectRoot();
    await verifyOutOfRootDiagnosticRecoveryOutputs();
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
  const json = path.join(root, "src", "data.json");
  const javascriptOutput = path.join(container, "src", "main.js");
  const jsonOutput = path.join(container, "src", "data.json");
  const nearbyNonProduct = path.join(container, "src", "external.json");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "export const value = 1;\n");
  fs.writeFileSync(json, '{"value":1}\n');
  writeConfig(root, {
    compilerOptions: {
      module: "nodenext",
      outDir: "..",
      resolveJsonModule: true,
    },
    files: ["src/main.ts", "src/data.json"],
  });

  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    for (const output of [javascriptOutput, jsonOutput]) {
      topology.setProjectInputs({ root, files: [output], globs: [] });
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, "compiler product\n");
      await expectProjectQuiet(
        changes,
        `${path.basename(output)} retriggered the project-input lane`,
      );
    }

    topology.setProjectInputs({
      root,
      files: [nearbyNonProduct],
      globs: [],
    });
    const previous = projectChangeCount(changes);
    fs.writeFileSync(nearbyNonProduct, "external data\n");
    await waitForProjectChange(
      changes,
      previous,
      "nearby external data was classified as a product",
    );
  } finally {
    topology.close();
  }
}

async function verifyRemovedOutFileLayout(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-removed-outfile-layout-");
  const source = path.join(root, "src", "main.ts");
  const configuredBundle = path.join(root, "dist", "bundle.js");
  const actualOutput = path.join(root, "src", "main.js");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "export const value = 1;\n");
  writeConfig(root, {
    compilerOptions: {
      module: "preserve",
      outFile: "dist/bundle.js",
    },
    files: ["src/main.ts"],
  });

  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    topology.setProjectInputs({
      root,
      files: [configuredBundle],
      globs: [],
    });
    fs.mkdirSync(path.dirname(configuredBundle), { recursive: true });
    fs.writeFileSync(configuredBundle, "external bundle\n");
    await waitForProjectChange(
      changes,
      0,
      "removed outFile was still classified as a product",
    );

    topology.setProjectInputs({ root, files: [actualOutput], globs: [] });
    fs.writeFileSync(actualOutput, "export const value = 1;\n");
    await expectProjectQuiet(
      changes,
      "actual per-source output retriggered the project-input lane",
    );
  } finally {
    topology.close();
  }
}

async function verifyPassthroughPathsUseProjectRoot(): Promise<void> {
  const container = TestProject.tmpdir("ttsc-passthrough-output-base-");
  const root = path.join(container, "project");
  const source = path.join(root, "src", "main.ts");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "export const value = 1;\n");
  writeConfig(root, { files: ["src/main.ts"] });

  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes, {
    cwd: container,
    outDir: "javascript",
    passthrough: [
      "--rootDir",
      ".",
      "--declaration",
      "--declarationDir",
      "types",
      "--incremental",
      "--tsBuildInfoFile",
      "cache/state.tsbuildinfo",
    ],
  });
  try {
    topology.refresh(false);
    for (const output of [
      path.join(root, "javascript", "src", "main.js"),
      path.join(root, "types", "src", "main.d.ts"),
      path.join(root, "cache", "state.tsbuildinfo"),
    ]) {
      topology.setProjectInputs({ root, files: [output], globs: [] });
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, "compiler product\n");
      await expectProjectQuiet(
        changes,
        `${path.relative(root, output)} used the launcher's outer cwd`,
      );
    }

    const nearby = path.join(root, "cache", "external.json");
    topology.setProjectInputs({ root, files: [nearby], globs: [] });
    const nearbyChanges = projectChangeCount(changes);
    fs.writeFileSync(nearby, '{"external":true}\n');
    await waitForProjectChange(
      changes,
      nearbyChanges,
      "nearby passthrough-relative data was classified as build info",
    );
  } finally {
    topology.close();
  }
}

async function verifyOutOfRootDiagnosticRecoveryOutputs(): Promise<void> {
  const container = TestProject.tmpdir("ttsc-out-of-root-recovery-");
  const root = path.join(container, "project");
  const source = path.join(root, "src", "main.ts");
  const externalRoot = path.join(container, "external");
  const external = path.join(externalRoot, "external.ts");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(externalRoot);
  fs.writeFileSync(source, "export const value = 1;\n");
  fs.writeFileSync(external, "export const external = 1;\n");
  writeConfig(root, {
    compilerOptions: {
      declaration: true,
      declarationDir: "types",
      declarationMap: true,
      outDir: "dist",
      rootDir: "src",
      sourceMap: true,
    },
    files: ["src/main.ts", "../external/external.ts"],
  });

  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    for (const output of [
      path.join(externalRoot, "external.js"),
      path.join(externalRoot, "external.js.map"),
      path.join(externalRoot, "external.d.ts"),
      path.join(externalRoot, "external.d.ts.map"),
    ]) {
      topology.setProjectInputs({ root, files: [output], globs: [] });
      fs.writeFileSync(output, "compiler recovery product\n");
      await expectProjectQuiet(
        changes,
        `${path.basename(output)} diagnostic-recovery emit was not excluded`,
      );
    }

    const externalJson = path.join(externalRoot, "external.json");
    topology.setProjectInputs({ root, files: [externalJson], globs: [] });
    const externalJsonChanges = projectChangeCount(changes);
    fs.writeFileSync(externalJson, '{"external":true}\n');
    await waitForProjectChange(
      changes,
      externalJsonChanges,
      "external JSON was incorrectly modeled as diagnostic-recovery emit",
    );
  } finally {
    topology.close();
  }
}

function createTopology(
  root: string,
  changes: WatchInputChange[],
  overrides: {
    cwd?: string;
    outDir?: string;
    passthrough?: string[];
  } = {},
): WatchTopology {
  return new WatchTopology(
    {
      cwd: overrides.cwd ?? root,
      emit: true,
      files: [],
      outDir: overrides.outDir,
      passthrough: overrides.passthrough,
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

async function waitForProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (projectChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(label);
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

async function expectProjectQuiet(
  changes: readonly WatchInputChange[],
  message: string,
): Promise<void> {
  const previous = projectChangeCount(changes);
  await delay();
  assert.equal(projectChangeCount(changes), previous, message);
}

function delay(milliseconds = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
