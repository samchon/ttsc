import { TestProject } from "@ttsc/testing";
import { pathToFileURL } from "node:url";

import {
  assert,
  createFakeGoBinary,
  fs,
  path,
  spawnNodeWorker,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies the ttsx descriptor fallback reports the source/config graph that
 * actually produced the descriptor, including missing higher-priority module
 * candidates that can redirect a later extensionless resolution.
 *
 * The isolated fallback previously returned only its root file. A selected ESM
 * dependency, its owning tsconfig, or an absent candidate could therefore
 * change without invalidating a persistent transform generation.
 *
 * 1. Load a TypeScript descriptor that imports extensionless ESM source.
 * 2. Capture its descriptor inputs through the real isolated ttsx fallback.
 * 3. Assert the selected source, owning tsconfig, and missing candidates for both
 *    extensionless and explicit-JavaScript substitutions carry evaluation-time
 *    fingerprints.
 *
 * @evidence contracts/testing.md#behavioral-verification Isolated ttsx returns selected source/config inputs, null fingerprints for absent candidates, and no proven hash for a config created during evaluation.
 * @evidence contracts/testing.md#independent-expectations Fixture topology fixes the selected and absent paths; inode comparisons handle equivalent spellings and the created config cannot have a pre-evaluation witness.
 * @evidence contracts/testing.md#distinguishing-cases Extensionless and explicit-JS substitution, NODE_PATH package selection, orphan config absence, and config creation during evaluation retain separate assertions.
 * @evidence contracts/testing.md#execution-ownership The exported test_loadprojectplugins_ttsx_descriptor_tracks_runtime_inputs entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary Plain Node workers call the built descriptor loader, which crosses into the isolated TypeScript/ttsx evaluator. Extensionless source forces the fallback where specified; its result envelope, effective environment, logging and input witnesses must survive actual child transport. A direct loader-semantic call with the suite loader already active cannot prove this route.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Each plain worker has a fresh module cache so the actual fallback cannot be bypassed by the test runner. The isolated-process inputs are reused within a scenario; rewritten descriptors or loader-error snapshots require a fresh evaluation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage Isolated ttsx returns selected source/config inputs, null fingerprints for absent candidates, and no proven hash for a config created during evaluation. These assertions stay in test_loadprojectplugins_ttsx_descriptor_tracks_runtime_inputs with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_loadprojectplugins_ttsx_descriptor_tracks_runtime_inputs =
  async () => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-ttsx-descriptor-inputs-"),
    );
    const source = root;
    fs.writeFileSync(path.join(root, "go.mod"), "module example/plugin\n");
    for (const file of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      const target = path.join(source, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "package plugin\n", "utf8");
    }
    fs.writeFileSync(
      path.join(source, "plugin.go"),
      "package main\n\nfunc main() {}\n",
    );

    const descriptor = path.join(root, "descriptor");
    fs.mkdirSync(descriptor, { recursive: true });
    fs.writeFileSync(
      path.join(descriptor, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    );
    const descriptorConfig = path.join(descriptor, "tsconfig.json");
    fs.writeFileSync(
      descriptorConfig,
      JSON.stringify({
        compilerOptions: {
          allowJs: true,
          module: "nodenext",
          moduleResolution: "nodenext",
          skipLibCheck: true,
          target: "es2022",
        },
        include: ["*.ts", "*.mjs"],
      }),
    );
    const selection = path.join(descriptor, "selection.mjs");
    fs.writeFileSync(
      selection,
      `export const source = ${JSON.stringify(source)};\n`,
      "utf8",
    );
    const explicitSelection = path.join(descriptor, "explicit.tsx");
    fs.writeFileSync(
      explicitSelection,
      `export const explicit = "explicit";\n`,
      "utf8",
    );
    const nearModules = path.join(root, "near", "node_modules");
    const farModules = path.join(root, "far", "node_modules");
    fs.mkdirSync(path.join(nearModules, "descriptor-probe"), {
      recursive: true,
    });
    const probePackage = path.join(farModules, "descriptor-probe");
    fs.mkdirSync(probePackage, { recursive: true });
    fs.writeFileSync(
      path.join(probePackage, "package.json"),
      JSON.stringify({ main: "entry" }),
      "utf8",
    );
    const probeEntryJson = path.join(probePackage, "entry.json");
    fs.writeFileSync(probeEntryJson, JSON.stringify("probe"), "utf8");
    const orphanPackage = path.join(
      TestProject.tmpdir("ttsc-ttsx-orphan-input-"),
      "node_modules",
      "orphan-source",
    );
    fs.mkdirSync(orphanPackage, { recursive: true });
    const orphanSource = path.join(orphanPackage, "selection.ts");
    fs.writeFileSync(
      path.join(orphanPackage, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    fs.writeFileSync(orphanSource, 'export const orphan = "orphan";\n');
    const refreshPackage = path.join(
      TestProject.tmpdir("ttsc-ttsx-config-refresh-"),
      "node_modules",
      "config-refresh",
    );
    fs.mkdirSync(refreshPackage, { recursive: true });
    fs.writeFileSync(
      path.join(refreshPackage, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    const refreshSeed = path.join(refreshPackage, "seed.ts");
    const refreshSelection = path.join(refreshPackage, "selection.tsx");
    fs.writeFileSync(
      refreshSelection,
      'function factory() { return "configured"; }\nexport const value = <probe />;\n',
      "utf8",
    );
    const refreshConfig = path.join(refreshPackage, "tsconfig.json");
    fs.writeFileSync(
      refreshSeed,
      [
        'import { writeFileSync } from "node:fs";',
        'import { createRequire } from "node:module";',
        `writeFileSync(${JSON.stringify(refreshConfig)}, ${JSON.stringify(JSON.stringify({ compilerOptions: { jsx: "react", jsxFactory: "factory", module: "nodenext", moduleResolution: "nodenext", target: "es2022" }, include: ["*.ts", "*.tsx"] }))});`,
        'export const seed = "seed";',
        'export const { value } = createRequire(import.meta.url)("./selection.tsx");',
        "",
      ].join("\n"),
      "utf8",
    );
    const entry = path.join(descriptor, "index.ts");
    fs.writeFileSync(
      entry,
      [
        `import { createRequire } from "node:module";`,
        `import { source } from "./selection";`,
        `import { explicit } from "./explicit.js?descriptor-input";`,
        `import { orphan } from ${JSON.stringify(pathToFileURL(orphanSource).href)};`,
        `import { seed, value } from ${JSON.stringify(pathToFileURL(refreshSeed).href)};`,
        `const require = createRequire(import.meta.url);`,
        `if (require("descriptor-probe") !== "probe" || orphan !== "orphan" || explicit !== "explicit") throw new Error("descriptor probe failed");`,
        `if (seed !== "seed" || value !== "configured") throw new Error("descriptor config refresh failed");`,
        `export default () => ({ name: "ttsx-inputs", source });`,
        "",
      ].join("\n"),
      "utf8",
    );

    const projectConfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      projectConfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: entry }] },
      }),
    );
    // The plugin module is the whole test root, so the caches live outside it:
    // a cache among the sources the binary is keyed on is refused
    // (samchon/ttsc#1505).
    const caches = TestProject.tmpdir("ttsc-ttsx-descriptor-caches-");
    const worker = path.join(root, "load-worker.cjs");
    fs.writeFileSync(
      worker,
      [
        `const { loadProjectPlugins } = require(${JSON.stringify(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "plugin", "internal", "load", "loadProjectPlugins.js"))});`,
        `const loaded = loadProjectPlugins({ binary: "", cacheDir: ${JSON.stringify(path.join(caches, "cache"))}, tsconfig: ${JSON.stringify(projectConfig)} });`,
        `process.stdout.write(JSON.stringify({ hostInputHashes: loaded.hostInputHashes, hostInputs: loaded.hostInputs }));`,
        "",
      ].join("\n"),
      "utf8",
    );
    const result = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_GO_BINARY: createFakeGoBinary(root),
        TTSC_GO_CACHE_DIR: path.join(caches, "go-cache"),
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
        NODE_PATH: [nearModules, farModules].join(path.delimiter),
      },
      script: worker,
    });
    assert.equal(result.status, 0, result.stderr);
    const loaded = JSON.parse(result.stdout) as {
      hostInputHashes: Record<string, string | null>;
      hostInputs: string[];
    };
    const inputs = loaded.hostInputs;
    const canonicalSelection = fs.realpathSync(selection);
    assert.ok(inputs.includes(canonicalSelection));
    assert.ok(
      inputs.some((input) => sameExistingFile(input, descriptorConfig)),
    );
    const missingMts = `${canonicalSelection.slice(0, -path.extname(canonicalSelection).length)}.mts`;
    assert.ok(inputs.includes(missingMts), JSON.stringify(inputs));
    assert.equal(loaded.hostInputHashes[missingMts], null);
    const missingExplicitTs = path.join(descriptor, "explicit.ts");
    assert.ok(inputs.includes(missingExplicitTs), JSON.stringify(inputs));
    assert.equal(loaded.hostInputHashes[missingExplicitTs], null);
    const missingPackageEntry = inputs.find(
      (input) =>
        path.basename(input) === "entry.js" &&
        sameExistingFile(path.dirname(input), probePackage),
    );
    assert.ok(missingPackageEntry, JSON.stringify(inputs));
    assert.equal(loaded.hostInputHashes[missingPackageEntry], null);
    const missingOrphanConfig = inputs.find(
      (input) =>
        path.basename(input) === "tsconfig.json" &&
        sameExistingFile(path.dirname(input), orphanPackage),
    );
    assert.ok(missingOrphanConfig, JSON.stringify(inputs));
    assert.equal(loaded.hostInputHashes[missingOrphanConfig], null);
    const observedRefreshConfig = inputs.find((input) =>
      sameExistingFile(input, refreshConfig),
    );
    assert.ok(observedRefreshConfig, JSON.stringify(inputs));
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        loaded.hostInputHashes,
        observedRefreshConfig,
      ),
      false,
      "a config created during descriptor evaluation must remain unproven",
    );
    assert.ok(
      Object.entries(loaded.hostInputHashes).some(
        ([input, hash]) =>
          typeof hash === "string" && sameExistingFile(input, descriptorConfig),
      ),
    );
  };

function sameExistingFile(left: string, right: string): boolean {
  try {
    const leftStats = fs.statSync(left);
    const rightStats = fs.statSync(right);
    return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
  } catch {
    return false;
  }
}
