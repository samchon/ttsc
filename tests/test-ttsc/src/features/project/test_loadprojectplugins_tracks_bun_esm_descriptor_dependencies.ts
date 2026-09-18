import { TestProject } from "@ttsc/testing";
import childProcess from "node:child_process";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a descriptor evaluated by Bun reports its static ESM dependencies
 * without accepting untracked ambient runtime configuration.
 *
 * Bun resolves static imports outside Node's `Module._resolveFilename` path.
 * The isolated evaluator must therefore observe Bun's resolver as well, or a
 * persistent bundler generation can survive after an imported selection file
 * changes.
 */
export const test_loadprojectplugins_tracks_bun_esm_descriptor_dependencies =
  (): void => {
    const bunBinary = process.env.TTSC_BUN_BINARY ?? "bun";
    const bun = childProcess.spawnSync(bunBinary, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (bun.status !== 0) return;

    const root = TestProject.tmpdir("ttsc-bun-esm-descriptor-input-");
    const project = path.join(root, "project");
    const source = path.join(root, "plugin-go");
    const ambientSource = path.join(root, "ambient-plugin-go");
    const selectionBase = path.join(root, "selection");
    const selection = `${selectionBase}.js`;
    const ambientSelection = path.join(root, "ambient-selection.js");
    const explicitPackage = path.join(root, "external");
    const explicitDirectory = path.join(explicitPackage, "nested");
    const explicitManifest = path.join(explicitPackage, "package.json");
    const nearerManifestCandidate = path.join(
      explicitDirectory,
      "package.json",
    );
    const explicitSelection = path.join(explicitDirectory, "explicit.tsx");
    const descriptor = path.join(project, "plugin.mts");
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(ambientSource, { recursive: true });
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    const selectedConfig = path.join(project, "tsconfig.ttsc.json");
    fs.writeFileSync(
      selectedConfig,
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "descriptor-selection": ["../selection.js"] },
          plugins: [{ transform: descriptor }],
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "descriptor-selection": ["../ambient-selection.js"] },
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(source, "go.mod"),
      "module example.com/bun-esm-descriptor\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(source, "main.go"), "package main\n", "utf8");
    fs.writeFileSync(
      path.join(ambientSource, "go.mod"),
      "module example.com/ambient-bun-esm-descriptor\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(ambientSource, "main.go"),
      "package main\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, ".env.local"),
      `TTSC_BUN_DESCRIPTOR_SOURCE=${ambientSource.replace(/\\/g, "/")}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "ambient-preload.ts"),
      `process.env.TTSC_BUN_DESCRIPTOR_SOURCE = ${JSON.stringify(ambientSource)};\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "bunfig.toml"),
      `preload = ["./ambient-preload.ts"]\n`,
      "utf8",
    );
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      const file = path.join(source, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "package generated\n", "utf8");
    }
    fs.writeFileSync(
      selection,
      `export default ${JSON.stringify(source)};\n`,
      "utf8",
    );
    fs.writeFileSync(
      ambientSelection,
      `export default ${JSON.stringify(ambientSource)};\n`,
      "utf8",
    );
    fs.mkdirSync(nearerManifestCandidate, { recursive: true });
    fs.writeFileSync(
      explicitManifest,
      JSON.stringify({ private: true, type: "module" }),
      "utf8",
    );
    fs.writeFileSync(explicitSelection, `export default true;\n`, "utf8");
    fs.writeFileSync(
      descriptor,
      [
        `import source from "../selection";`,
        `import configuredSource from "descriptor-selection";`,
        `import explicit from "../external/nested/explicit.js";`,
        `if (configuredSource !== source) throw new Error("selected tsconfig paths were ignored");`,
        `if (!explicit) throw new Error("explicit JavaScript substitution failed");`,
        `export default { name: "bun-esm", source: process.env.TTSC_BUN_DESCRIPTOR_SOURCE ?? source };`,
        "",
      ].join("\n"),
      "utf8",
    );

    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const loaded = loadProjectPlugins({
      binary: "",
      cacheDir: path.join(root, "cache"),
      cwd: project,
      env: {
        ...process.env,
        TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
        TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
        TTSC_NODE_BINARY: bunBinary,
      },
      tsconfig: selectedConfig,
    });

    assert.equal(loaded.nativePlugins[0]?.name, "bun-esm");
    assert.equal(loaded.nativePlugins[0]?.source, source);
    const observedSelection = loaded.hostInputs.find((input) =>
      sameExistingFile(input, selection),
    );
    assert.ok(
      observedSelection !== undefined,
      JSON.stringify(loaded.hostInputs),
    );
    assert.ok(
      loaded.hostInputs.some((input) =>
        sameMissingFile(input, `${selectionBase}.ts`),
      ),
      JSON.stringify(loaded.hostInputs),
    );
    assert.equal(
      loaded.hostInputs.includes(path.join(project, "tsconfig.json")),
      false,
    );
    const missingExplicitTs = path.join(explicitDirectory, "explicit.ts");
    assert.ok(
      loaded.hostInputs.includes(missingExplicitTs),
      JSON.stringify(loaded.hostInputs),
    );
    assert.equal(loaded.hostInputHashes[missingExplicitTs], null);
    assert.ok(loaded.hostInputs.includes(nearerManifestCandidate));
    assert.ok(loaded.hostInputs.includes(explicitManifest));

    const worker = path.join(root, "bun-parent-worker.cjs");
    fs.writeFileSync(
      worker,
      [
        `const { loadProjectPlugins } = require(${JSON.stringify(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "plugin", "internal", "load", "loadProjectPlugins.js"))});`,
        `delete process.env.TTSC_BUN_DESCRIPTOR_SOURCE;`,
        `const loaded = loadProjectPlugins({`,
        `  binary: "",`,
        `  cacheDir: ${JSON.stringify(path.join(root, "cache"))},`,
        `  cwd: ${JSON.stringify(project)},`,
        `  tsconfig: ${JSON.stringify(selectedConfig)},`,
        `});`,
        `process.stdout.write(JSON.stringify(loaded.hostInputs));`,
        "",
      ].join("\n"),
      "utf8",
    );
    const workerEnv: NodeJS.ProcessEnv = {
      ...process.env,
      TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
      TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
    };
    delete workerEnv.TTSC_NODE_BINARY;
    delete workerEnv.TTSC_BUN_DESCRIPTOR_SOURCE;
    const fromBunParent = childProcess.spawnSync(bunBinary, [worker], {
      cwd: project,
      encoding: "utf8",
      env: workerEnv,
      windowsHide: true,
    });
    assert.equal(fromBunParent.status, 0, fromBunParent.stderr);
    const parentInputs = JSON.parse(fromBunParent.stdout) as string[];
    const parentSelection = parentInputs.find((input) =>
      sameExistingFile(input, selection),
    );
    assert.ok(parentSelection !== undefined);
    assert.ok(
      parentInputs.some((input) =>
        sameMissingFile(input, `${selectionBase}.ts`),
      ),
    );
    assert.ok(parentInputs.includes(missingExplicitTs));
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

function sameMissingFile(left: string, right: string): boolean {
  return (
    path.basename(left).toLowerCase() === path.basename(right).toLowerCase() &&
    sameExistingFile(path.dirname(left), path.dirname(right))
  );
}
