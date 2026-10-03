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
 * @evidence contracts/testing.md#independent-expectations Authored topology fixes selected and absent paths, null missing proofs and the config created during evaluation. Native stat identity compares nonzero inodes; when unavailable, independent realpath equality compares only the fixture's resolved spelling, not arbitrary hard-link identity. A string config hash is observed, not compared with an independent byte digest.
 * @evidence contracts/testing.md#distinguishing-cases Extensionless and explicit-JS substitution, NODE_PATH package selection, orphan config absence, and config creation during evaluation retain separate assertions.
 * @evidence contracts/testing.md#execution-ownership The exported test_loadprojectplugins_ttsx_descriptor_tracks_runtime_inputs entry is discovered from features/ttsc/source-plugin by the E2E TestExecutor. One plain worker invokes the workspace-built loader with selected native ttsc/tsgo and scripted Go publication; actual evaluator attempts and compiler generations are not counted by these result assertions.
 * @evidence contracts/e2e.md#necessary-boundary Plain Node workers call the built descriptor loader, which crosses into the isolated TypeScript/ttsx evaluator. Extensionless source forces the fallback where specified; its result envelope, effective environment, logging and input witnesses must survive actual child transport. A direct loader-semantic call with the suite loader already active cannot prove this route.
 * @evidence contracts/e2e.md#shared-execution One caller shares the authored descriptor graph. Separate orphan and refresh package roots preserve missing-ancestor and evaluation-time config creation; the cache root stays outside keyed source inputs. These four temporary roots share selected producers rather than four independent installations. A fresh caller module cache isolates the suite loader, but does not by itself certify the chosen evaluator route or preparation cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each tracked source/orphan/refresh/cache root is retained before preparation or use; the physical source path is resolved after retaining its original tracked spelling. Environment and NODE_PATH overrides are worker-local. Actual direct worker close plus status0/signalnull precede result inspection; error or join-deadline rejection does not permit root reuse and does not certify descendant closure. Created config and missing candidates remain distinct from proven hashes.
 * @evidence contracts/e2e.md#preserved-coverage Isolated ttsx returns selected source/config inputs, null fingerprints for absent candidates, and no proven hash for a config created during evaluation. These assertions stay in test_loadprojectplugins_ttsx_descriptor_tracks_runtime_inputs with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_loadprojectplugins_ttsx_descriptor_tracks_runtime_inputs =
  async () => {
    const temporary = TestProject.tmpdir("ttsc-ttsx-descriptor-inputs-");
    TestProject.retainTemporaryDirectory(temporary);
    const root = TestProject.physicalPath(temporary);
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
    const orphanRoot = TestProject.tmpdir("ttsc-ttsx-orphan-input-");
    TestProject.retainTemporaryDirectory(orphanRoot);
    const orphanPackage = path.join(
      orphanRoot,
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
    const refreshRoot = TestProject.tmpdir("ttsc-ttsx-config-refresh-");
    TestProject.retainTemporaryDirectory(refreshRoot);
    const refreshPackage = path.join(
      refreshRoot,
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
    TestProject.retainTemporaryDirectory(caches);
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
    assert.equal(result.signal, null);
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
    if (leftStats.ino === 0 || rightStats.ino === 0)
      return fs.realpathSync(left) === fs.realpathSync(right);
    return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
  } catch {
    return false;
  }
}
