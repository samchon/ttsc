import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TtscCompiler } from "ttsc";

/**
 * Verifies a common source root preserves package-local plugin resolution.
 *
 * An isolated monorepo installs its descriptor only beside the selected config.
 * The descriptor resolves its own package through the factory context, so an
 * absolute entry cannot hide a wrong context after entry resolution succeeds.
 *
 * 1. Borrow the runtime batch's native source and content-addressed cache.
 * 2. Transform backend and sibling sources through discovery, bare and absolute
 *    entries.
 * 3. Preserve the default root and explicit disable controls, then reject a
 *    missing entry with its resolution context.
 *
 * @evidence contracts/testing.md#behavioral-verification Real public TtscCompiler transforms two authored source files through an isolated package descriptor and the existing source-pipeline Go plugin. Exact transformed literals and retained neighbors distinguish successful plugin execution from unchanged source; disabled selections retain the original marker, while missing entries and unavailable compiler overrides must produce attributed exceptions. Sparse runtime overrides inherit the actual compiler, explicit undefined removes it, and an explicit binary wins over a conflicting environment value.
 * @evidence contracts/testing.md#independent-expectations The config includes the backend and sibling explicitly, native root coordinates define their literal output keys, and the existing fixture's documented uppercase prefix operation defines CONFIG:PLUGIN:done. An authored neighbor must remain unchanged. The descriptor independently resolves its own manifest from context.projectRoot and compares its owner with context.dirname; no loader helper derives an expectation.
 * @evidence contracts/testing.md#distinguishing-cases Covers omitted discovery, configured bare, explicit bare, explicit absolute, a returned relative source, a relative helper runtime at the source root, omitted source root, false and empty plugin overrides, a disabled descriptor and a missing bare package. Compiler selection distinguishes inherited, undefined, missing and explicit-binary inputs plus native Windows aliases or independent POSIX spellings. Isolated node_modules exists only under the config directory; explicit common-root successes require both backend and sibling outputs. Source units own inheritance, wrapper pluginConfigDir and discovery-input invalidation.
 * @evidence contracts/testing.md#execution-ownership The Runtime batch invokes this named scene with its prepared native source and cache. The public compiler uses actual descriptor isolation and native compiler execution; this is not a portable decision unit.
 * @evidence contracts/e2e.md#necessary-boundary Entry discovery, descriptor createRequire self-resolution, native plugin admission and source-coordinate publication must connect through the public compiler; direct resolver assertions cannot prove a plugin actually transforms the sibling program.
 * @evidence contracts/e2e.md#shared-execution All rows share one private consumer, immutable source pair, descriptor and runtime batch native source/cache. Changed plugin-selection inputs justify separate compiler calls; no package installation or independent Go source producer is added. The default-root control changes the native source coordinate intentionally.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The private consumer owns its manifests, config, descriptor and run log; each synchronous compiler call settles before the next input change. Shared production caches validate their own source and context inputs. The scene removes its private root in finally and does not clear or mutate the borrowed native source/cache.
 * @evidence contracts/e2e.md#preserved-coverage Adds isolated config-versus-source-root coverage without moving or deleting existing compiler, wrapper, runtime or Metro cases; independent rows retain all collected failures.
 */
export function case_project_root_keeps_isolated_plugin_resolution_anchored_at_config(inputs: {
  source: string;
  cacheDir: string;
}): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-isolated-plugin-root-"),
  );
  const backend = path.join(root, "apps/backend");
  const packageRoot = path.join(backend, "node_modules/isolated-root-plugin");
  const tsconfig = path.join(backend, "tsconfig.dev.json");
  const descriptor = path.join(packageRoot, "descriptor.cjs");
  const runtimeName =
    process.platform === "win32" ? "source-node.exe" : "source-node";
  const missingCompiler = path.join(root, "missing-compiler");
  const fixtures = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests/test-e2e/fixtures/ttsc/plugin-resolution-root",
  );
  const plugin = {
    transform: "isolated-root-plugin/descriptor.cjs",
    name: "isolated-root-plugin",
    fixtureSource: inputs.source,
    operation: "source-pipeline",
    prefix: "config:",
    suffix: ":done",
    runLog: path.join(root, "program-runs.bin"),
  };
  const failures: unknown[] = [];
  try {
    fs.mkdirSync(packageRoot, { recursive: true });
    for (const file of [
      "apps/backend/src/main.ts",
      "packages/shared/src/main.ts",
    ]) {
      const target = path.join(root, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(fixtures, "source.ts"), target);
    }
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ private: true }),
    );
    fs.writeFileSync(
      path.join(backend, "package.json"),
      JSON.stringify({
        private: true,
        dependencies: { "isolated-root-plugin": "1.0.0" },
      }),
    );
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "isolated-root-plugin",
        version: "1.0.0",
        ttsc: { plugin },
      }),
    );
    fs.copyFileSync(path.join(fixtures, "descriptor.cjs"), descriptor);
    fs.symlinkSync(
      inputs.source,
      path.join(root, "native-source"),
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.copyFileSync(process.execPath, path.join(root, runtimeName));
    if (process.platform !== "win32")
      fs.chmodSync(path.join(root, runtimeName), 0o755);
    const cases: {
      name: string;
      configured?: (typeof plugin)[];
      plugins?:
        | (typeof plugin | { enabled: false; transform: string })[]
        | false;
      defaultRoot?: boolean;
      transformed?: boolean;
      missing?: boolean;
      env?: NodeJS.ProcessEnv;
      binary?: string;
      errorPattern?: RegExp;
      errorContains?: string;
    }[] = [
      { name: "automatic discovery" },
      { name: "configured bare entry", configured: [plugin] },
      { name: "explicit bare entry", plugins: [plugin] },
      {
        name: "explicit absolute entry and internal resolution",
        plugins: [{ ...plugin, transform: descriptor }],
      },
      {
        name: "relative source keeps native root",
        plugins: [{ ...plugin, fixtureSource: "./native-source" }],
      },
      {
        name: "relative helper runtime keeps source root",
        plugins: [{ ...plugin, transform: descriptor }],
        env: { TTSC_NODE_BINARY: `.${path.sep}${runtimeName}` },
      },
      {
        name: "undefined compiler override removes inherited selection",
        plugins: [plugin],
        env: { TTSC_TSGO_BINARY: undefined },
        errorPattern: /ttsc: typescript is required\./,
      },
      {
        name: "missing compiler override is refused",
        plugins: [plugin],
        env: { TTSC_TSGO_BINARY: missingCompiler },
        errorPattern:
          /ttsc: explicit tsgo binary must be an existing absolute path:/,
        errorContains: missingCompiler,
      },
      {
        name: "explicit binary wins over environment override",
        plugins: [plugin],
        binary: TestProject.TSGO_BINARY,
        env: { TTSC_TSGO_BINARY: missingCompiler },
      },
      {
        name: "compiler environment name follows native identity",
        plugins: [plugin],
        env: { ttsc_tsgo_binary: missingCompiler },
        ...(process.platform === "win32"
          ? {
              errorPattern:
                /ttsc: explicit tsgo binary must be an existing absolute path:/,
              errorContains: missingCompiler,
            }
          : {}),
      },
      { name: "default source root", defaultRoot: true },
      { name: "false bypasses discovery", plugins: false, transformed: false },
      { name: "empty bypasses discovery", plugins: [], transformed: false },
      {
        name: "disabled entry is not evaluated",
        plugins: [{ transform: "missing-disabled-plugin", enabled: false }],
        transformed: false,
      },
      {
        name: "missing entry reports specifier and config anchor",
        plugins: [
          { ...plugin, transform: "missing-isolated-root-plugin/descriptor" },
        ],
        missing: true,
      },
    ];
    for (const scenario of cases) {
      try {
        fs.writeFileSync(
          tsconfig,
          JSON.stringify({
            compilerOptions: {
              target: "ES2022",
              module: "commonjs",
              types: [],
              plugins: scenario.configured ?? [],
            },
            include: ["src/**/*.ts", "../../packages/shared/src/**/*.ts"],
          }),
        );
        const result = new TtscCompiler({
          cwd: backend,
          tsconfig,
          cacheDir: inputs.cacheDir,
          env: scenario.env,
          binary: scenario.binary,
          ...(scenario.defaultRoot ? {} : { projectRoot: root }),
          ...(scenario.plugins === undefined
            ? {}
            : { plugins: scenario.plugins }),
        }).transform();
        if (scenario.missing || scenario.errorPattern !== undefined) {
          assert.equal(result.type, "exception", JSON.stringify(result));
          if (result.type !== "exception") continue;
          assert.ok(
            typeof result.error === "object" &&
              result.error !== null &&
              "message" in result.error,
          );
          const message = result.error.message;
          assert.ok(typeof message === "string");
          if (scenario.missing) {
            assert.match(message, /missing-isolated-root-plugin\/descriptor/);
            assert.ok(message.includes(JSON.stringify(backend)), message);
          } else if (scenario.errorPattern !== undefined) {
            assert.match(message, scenario.errorPattern);
            if (scenario.errorContains !== undefined) {
              assert.ok(message.includes(scenario.errorContains), message);
            }
          }
          continue;
        }
        assert.equal(result.type, "success", JSON.stringify(result));
        if (result.type !== "success") continue;
        const keys = scenario.defaultRoot
          ? ["src/main.ts"]
          : ["apps/backend/src/main.ts", "packages/shared/src/main.ts"];
        for (const key of keys) {
          const output: string | undefined = result.typescript[key];
          assert.ok(
            typeof output === "string",
            `${scenario.name}: missing ${key}`,
          );
          assert.match(output, /["']retained-neighbor["']/);
          if (scenario.transformed === false) {
            assert.match(output, /["']__TTSC_NATIVE_PIPELINE__["']/);
          } else {
            assert.match(output, /["']CONFIG:PLUGIN:done["']/);
            assert.doesNotMatch(output, /__TTSC_NATIVE_PIPELINE__/);
          }
        }
        if (scenario.transformed !== false) {
          assert.ok(
            Object.keys(result.pluginSources ?? {}).length > 0,
            scenario.name,
          );
        }
      } catch (cause) {
        failures.push(new Error(scenario.name, { cause }));
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  if (failures.length !== 0) {
    throw new AggregateError(
      failures,
      "isolated plugin-root compiler cases failed",
    );
  }
}
