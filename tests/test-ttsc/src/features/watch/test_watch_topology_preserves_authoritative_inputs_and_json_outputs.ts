import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  type IRecordedWatcher,
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

const WATCH_EVENT_DEADLINE_MS = 30_000;
const subscriptions = new WeakMap<WatchTopology, IRecordedWatcher[]>();
const membership = new Map<string, string[]>();

/**
 * Verifies predicted products never erase authoritative compiler inputs and
 * every copied compiler product remains excluded from the project-input lane.
 *
 * 1. Keep an explicit declaration input that collides with a predicted output
 *    under independently authored overwrite-collision options.
 * 2. Preserve `.mjs` and `.cjs` inputs whose paths collide only with an
 *    incorrectly changed extension.
 * 3. Suppress nested products emitted above the project without `rootDir`.
 * 4. Treat removed `outFile` as absent from the output-layout contract.
 * 5. Resolve launcher-owned output paths from the execution cwd and passthrough
 *    paths from the compiler's project cwd.
 * 6. Suppress TS/JS diagnostic-recovery products outside the mapping root, while
 *    retaining an adjacent JSON negative twin.
 * 7. Keep a directory containing the last of 1,000 compiler inputs selectable for
 *    1,000 declared JSON paths, then distinguish products and adjacent input.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: predicted products never erase authoritative compiler inputs and every copied compiler product remains excluded from the project-input lane. 1. Keep an explicit declaration input that collides with a predicted output under independently authored overwrite-collision options. 2. Preserve `.mjs` and `.cjs` inputs whose paths collide only with an incorrectly changed extension. 3. Suppress nested products emitted above the project without `rootDir`. 4. Treat removed `outFile` as absent from the output-layout contract. 5. Resolve launcher-owned output paths from the execution cwd and passthrough paths from the compiler's project cwd. 6. Suppress TS/JS diagnostic-recovery products outside the mapping root, while retaining an adjacent JSON negative twin. 7. Preserve 1,000 compiler inputs and 1,000 literal JSON declarations through public topology operations, contrasting a last-member source overlap with product-only and adjacent-input controls. No private containment counter or complexity bound is asserted.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Keep an explicit declaration input that collides with a predicted output under independently authored overwrite-collision options. 2. Preserve `.mjs` and `.cjs` inputs whose paths collide only with an incorrectly changed extension. 3. Suppress nested products emitted above the project without `rootDir`. 4. Treat removed `outFile` as absent from the output-layout contract. 5. Resolve launcher-owned output paths from the execution cwd and passthrough paths from the compiler's project cwd. 6. Suppress TS/JS diagnostic-recovery products outside the mapping root, while retaining an adjacent JSON negative twin. 7. Preserve 1,000 compiler inputs and 1,000 literal JSON declarations through public topology operations, contrasting a last-member source overlap with product-only and adjacent-input controls. No private containment counter or complexity bound is asserted.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology consumes independently authored absolute compiler membership and actual config, output and physical-path decisions through recorded source-adapter subscriptions. No compiler child or native observer runs. The retained E2E owns compiler population and native delivery until its replacement corpus is verified.
 */
export const test_watch_topology_preserves_authoritative_inputs_and_json_outputs =
  async (): Promise<void> => {
    const failures: unknown[] = [];
    for (const verify of [
      verifyDeclarationInputCollision,
      verifyJavaScriptExtensionInputs,
      verifyJsonCopyIsProduct,
      verifyRemovedOutFileLayout,
      verifyCompilerFacingPathsUseTheirExecutionRoots,
      verifyOutOfRootDiagnosticRecoveryOutputs,
      verifyOutputOverlapThroughPublicDeclarations,
    ]) {
      try {
        await verify();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "authoritative input/output decision matrix failed",
      );
  };

async function verifyDeclarationInputCollision(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-authoritative-declaration-input-"),
  );
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

  membership.set(root, [source, declaration]);
  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    fs.writeFileSync(declaration, "export declare const external: 2;\n");
    notify(topology, declaration);
    await waitForCompilerChange(changes, 0, "declaration input collision");
  } finally {
    topology.close();
  }
}

async function verifyJavaScriptExtensionInputs(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-authoritative-javascript-input-"),
  );
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

  membership.set(root, [moduleSource, commonSource, moduleInput, commonInput]);
  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    fs.writeFileSync(moduleInput, "export const value = 2;\n");
    notify(topology, moduleInput);
    await waitForCompilerChange(changes, 0, ".mjs output extension");
    const previous = compilerChangeCount(changes);
    fs.writeFileSync(commonInput, "export const value = 2;\n");
    notify(topology, commonInput);
    await waitForCompilerChange(changes, previous, ".cjs output extension");

    for (const output of [
      path.join(root, "dist", "src", "module.mjs"),
      path.join(root, "dist", "src", "common.cjs"),
    ]) {
      topology.setProjectInputs({ root, files: [output], globs: [] });
      const projectChanges = projectChangeCount(changes);
      fs.writeFileSync(output, "export const value = 2;\n");
      notify(topology, output, false);
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
  const container = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-json-copy-product-"),
  );
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

  membership.set(root, [source, json]);
  const changes: WatchInputChange[] = [];
  const topology = createTopology(root, changes);
  try {
    topology.refresh(false);
    for (const output of [javascriptOutput, jsonOutput]) {
      topology.setProjectInputs({ root, files: [output], globs: [] });
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, "compiler product\n");
      notify(topology, output, false);
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
    notify(topology, nearbyNonProduct);
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
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-removed-outfile-layout-"),
  );
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

  membership.set(root, [source]);
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
    notify(topology, configuredBundle);
    await waitForProjectChange(
      changes,
      0,
      "removed outFile was still classified as a product",
    );

    topology.setProjectInputs({ root, files: [actualOutput], globs: [] });
    fs.writeFileSync(actualOutput, "export const value = 1;\n");
    notify(topology, actualOutput, false);
    await expectProjectQuiet(
      changes,
      "actual per-source output retriggered the project-input lane",
    );
  } finally {
    topology.close();
  }
}

async function verifyCompilerFacingPathsUseTheirExecutionRoots(): Promise<void> {
  const container = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-passthrough-output-base-"),
  );
  const root = path.join(container, "project");
  const source = path.join(root, "src", "main.ts");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "export const value = 1;\n");
  writeConfig(root, { files: ["src/main.ts"] });

  membership.set(root, [source]);
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
      path.join(container, "javascript", "src", "main.js"),
      path.join(root, "types", "src", "main.d.ts"),
      path.join(root, "cache", "state.tsbuildinfo"),
    ]) {
      topology.setProjectInputs({ root, files: [output], globs: [] });
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, "compiler product\n");
      notify(topology, output, false);
      await expectProjectQuiet(
        changes,
        `${output} used the wrong compiler execution root`,
      );
    }

    const nearby = path.join(root, "cache", "external.json");
    topology.setProjectInputs({ root, files: [nearby], globs: [] });
    const nearbyChanges = projectChangeCount(changes);
    fs.writeFileSync(nearby, '{"external":true}\n');
    notify(topology, nearby);
    await waitForProjectChange(
      changes,
      nearbyChanges,
      "nearby passthrough-relative data was classified as build info",
    );
  } finally {
    topology.close();
  }
}

async function verifyOutputOverlapThroughPublicDeclarations(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-overlap-source-"),
  );
  const sourceRoot = path.join(root, "source");
  const output = path.join(root, "generated");
  fs.mkdirSync(sourceRoot);
  fs.mkdirSync(output);
  const inputs = Array.from({ length: 1_000 }, (_, index) =>
    index === 999
      ? path.join(output, "compiler.ts")
      : path.join(sourceRoot, `${index}.ts`),
  );
  for (const input of inputs)
    fs.writeFileSync(input, "export const value = 1;\n");
  const configure = (): void => {
    writeConfig(root, {
      compilerOptions: { rootDir: ".", outDir: "generated" },
      files: inputs.map((input) => path.relative(root, input)),
    });
    membership.set(root, [...inputs]);
  };
  configure();
  const declared = Array.from({ length: 1_000 }, (_, index) =>
    path.join(output, `plugin-${index}.json`),
  );
  const observed = recordWatchers(watchDirectoryThroughFsWatch);
  const changes: WatchInputChange[] = [];
  let liveRoots: readonly string[] = [];
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
      onProjectInputWatchRoots: (roots) => {
        liveRoots = [...roots];
      },
      onTopologyChange: () => undefined,
    },
    observed.openDirectoryWatch,
    observed.openFileWatch,
    fs.readdirSync,
    () => [...inputs],
  );
  subscriptions.set(topology, observed.watchers);
  const failures: unknown[] = [];
  const verify = async (
    name: string,
    run: () => Promise<void>,
  ): Promise<void> => {
    try {
      await run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    topology.refresh(false);
    await verify(
      "last compiler member keeps every declaration selectable",
      async () => {
        topology.setProjectInputs({
          root: sourceRoot,
          files: declared,
          globs: [],
        });
        for (const candidate of declared)
          assert.ok(
            liveRoots.some((anchor) => {
              const relative = path.relative(anchor, candidate);
              return (
                relative !== ".." &&
                !relative.startsWith(`..${path.sep}`) &&
                !path.isAbsolute(relative)
              );
            }),
            `no project anchor covers ${candidate}`,
          );
        for (const candidate of [declared[0]!, declared[999]!]) {
          const before = changes.length;
          fs.writeFileSync(candidate, '{"input":true}\n');
          notify(topology, candidate);
          await waitForProjectChange(
            changes,
            projectChangeCount(changes.slice(0, before)),
            `overlapping output suppressed ${candidate}`,
          );
          assert.ok(
            changes
              .slice(before)
              .some(
                (change) =>
                  change.kind === "project" && change.path === candidate,
              ),
          );
        }
      },
    );
    await verify(
      "same directory becomes product-only without the compiler member",
      async () => {
        const moved = path.join(sourceRoot, "999.ts");
        fs.renameSync(inputs[999]!, moved);
        inputs[999] = moved;
        configure();
        topology.refresh(false);
        topology.setProjectInputs({
          root: sourceRoot,
          files: declared,
          globs: [],
        });
        assert.deepEqual(liveRoots, []);
        const previous = projectChangeCount(changes);
        fs.writeFileSync(declared[0]!, '{"product":true}\n');
        notify(topology, declared[0]!, false);
        await delay();
        assert.equal(projectChangeCount(changes), previous);
      },
    );
    await verify("adjacent directory remains a project input", async () => {
      const adjacent = path.join(root, "generated-other", "plugin.json");
      fs.mkdirSync(path.dirname(adjacent));
      topology.setProjectInputs({
        root: sourceRoot,
        files: [adjacent],
        globs: [],
      });
      const before = changes.length;
      fs.writeFileSync(adjacent, '{"adjacent":true}\n');
      notify(topology, adjacent);
      await waitForProjectChange(
        changes,
        projectChangeCount(changes.slice(0, before)),
        "output prefix suppressed adjacent input",
      );
      assert.ok(
        changes
          .slice(before)
          .some(
            (change) => change.kind === "project" && change.path === adjacent,
          ),
      );
    });
  } finally {
    topology.close();
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "public output-overlap decisions failed",
    );
}

async function verifyOutOfRootDiagnosticRecoveryOutputs(): Promise<void> {
  const container = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-out-of-root-recovery-"),
  );
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

  membership.set(root, [source, external]);
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
      notify(topology, output, false);
      await expectProjectQuiet(
        changes,
        `${path.basename(output)} diagnostic-recovery emit was not excluded`,
      );
    }

    const externalJson = path.join(externalRoot, "external.json");
    topology.setProjectInputs({ root, files: [externalJson], globs: [] });
    const externalJsonChanges = projectChangeCount(changes);
    fs.writeFileSync(externalJson, '{"external":true}\n');
    notify(topology, externalJson);
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
  const observed = recordWatchers(watchDirectoryThroughFsWatch);
  const instance = new WatchTopology(
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
    observed.openDirectoryWatch,
    observed.openFileWatch,
    fs.readdirSync,
    () => {
      const inputs = membership.get(root);
      assert.ok(inputs, "compiler membership must be explicitly authored");
      return inputs;
    },
  );
  subscriptions.set(instance, observed.watchers);
  return instance;
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

/**
 * Deliver attention only through a recorded subscription covering the entry.
 * Positive input mutations require a subscription. Products can have none:
 * their omitted registration itself keeps that path outside observer delivery.
 */
function notify(
  topology: WatchTopology,
  changed: string,
  requireSubscription = true,
): void {
  const watchers = subscriptions.get(topology);
  assert.ok(watchers);
  let entry = TestProject.physicalPath(changed);
  while (
    !watchers.some((watcher) => {
      if (!watcher.active) return false;
      const relative = path.relative(watcher.location, entry);
      return (
        relative === "" ||
        relative === path.basename(entry) ||
        (watcher.recursive &&
          !relative.startsWith("..") &&
          !path.isAbsolute(relative))
      );
    })
  ) {
    const parent = path.dirname(entry);
    if (parent === entry) {
      assert.equal(
        requireSubscription,
        false,
        `no subscription covers ${changed}`,
      );
      return;
    }
    entry = parent;
  }
  deliverWatchEvent(watchers, entry, "rename");
}
