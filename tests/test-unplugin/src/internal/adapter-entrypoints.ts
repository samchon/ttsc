import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const REQUIRE_FROM_TEST = createRequire(
  path.join(
    TestProject.WORKSPACE_ROOT,
    "tests",
    "test-unplugin",
    "package.json",
  ),
);
const INTERNAL_DIR = path.join(
  TestProject.WORKSPACE_ROOT,
  "tests",
  "test-unplugin",
  "src",
  "internal",
);

/**
 * Asserts that the farm, rolldown, rspack, and webpack adapter entrypoints each
 * resolve to a callable factory function. It also fills one raw plugin cache
 * and proves that both webpack-like shutdown hooks clear it before the next
 * delivery, without starting another test process.
 */
async function assertAdapterEntrypointsExposeFactories() {
  const unpluginFarm = await TestUnpluginRuntime.loadUnpluginAdapter("farm");
  const unpluginRolldown =
    await TestUnpluginRuntime.loadUnpluginAdapter("rolldown");
  const unpluginRspack =
    await TestUnpluginRuntime.loadUnpluginAdapter("rspack");
  const unpluginWebpack =
    await TestUnpluginRuntime.loadUnpluginAdapter("webpack");
  assert.equal(typeof unpluginFarm, "function");
  assert.equal(typeof unpluginRolldown, "function");
  assert.equal(typeof unpluginRspack, "function");
  assert.equal(typeof unpluginWebpack, "function");

  const { unplugin } = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const runLog = path.join(root, "dist", "compiles.bin");
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins.push({
    transform: "./plugin.cjs",
    name: "runs",
    operation: "count-runs",
    runLog,
  });
  fs.mkdirSync(path.dirname(runLog), { recursive: true });
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const sourceFile = TestUnpluginProject.mainFile(root);
  const source = fs.readFileSync(sourceFile, "utf8");
  for (const framework of ["webpack", "rspack"] as const) {
    assert.equal(typeof unplugin[framework], "function");
  }
  const raw = unplugin.raw(undefined, {
    framework: "webpack",
    webpack: { compiler: {} },
  } as never);
  const disposals = new Map<"webpack" | "rspack", () => void>();
  for (const framework of ["webpack", "rspack"] as const) {
    let registeredName: string | undefined;
    raw[framework]?.({
      hooks: {
        shutdown: {
          tap(name: string, callback: () => void) {
            registeredName = name;
            disposals.set(framework, callback);
          },
        },
      },
    } as never);
    assert.equal(registeredName, "ttsc-unplugin", framework);
    assert.equal(typeof disposals.get(framework), "function", framework);
  }
  const context = { addWatchFile(_file: string) {} };
  assert.equal(typeof raw.transform, "function");
  const deliver = async (): Promise<void> => {
    const result = await (
      raw.transform as unknown as (
        this: typeof context,
        source: string,
        id: string,
      ) => Promise<string | { code: string } | undefined>
    ).call(context, source, sourceFile);
    const code = typeof result === "string" ? result : result?.code;
    assert.ok(typeof code === "string");
    TestUnpluginProject.assertTransformedToPlugin(code);
  };
  try {
    await deliver();
    assert.equal(
      fs.statSync(runLog).size,
      1,
      "the cold delivery compiles once",
    );
    for (const framework of ["webpack", "rspack"] as const) {
      disposals.get(framework)?.();
      await deliver();
      assert.equal(
        fs.statSync(runLog).size,
        framework === "webpack" ? 2 : 3,
        `${framework} shutdown must clear the generation`,
      );
    }
  } finally {
    for (const dispose of disposals.values()) dispose();
  }
}

/**
 * Asserts that all ESM entrypoints expose a callable `default` export via
 * dynamic `import()`, covering the root index and every bundler-specific
 * adapter.
 */
async function assertAdapterEntrypointsSupportEsmDefaultImport() {
  const root = await import(TestUnpluginRuntime.libUrl("index"));
  assert.equal(typeof root.default.vite, "function", "index");

  for (const entrypoint of [
    "bun",
    "esbuild",
    "farm",
    "next",
    "rolldown",
    "rollup",
    "rspack",
    "turbopack",
    "vite",
    "webpack",
  ]) {
    const mod = await import(TestUnpluginRuntime.libUrl(entrypoint));
    assert.equal(typeof mod.default, "function", entrypoint);
  }
}

/**
 * Asserts that all CJS entrypoints are resolvable via `require()` and that the
 * public `api` module exposes `resolveOptions` and `transformTtsc`.
 *
 * Uses a `createRequire` rooted at the test-unplugin package to simulate the
 * resolution context of a CJS consumer.
 */
function assertAdapterEntrypointsSupportCjsRequire() {
  const root = REQUIRE_FROM_TEST(TestUnpluginRuntime.libPath("index", "js"));
  assert.equal(typeof root.default.vite, "function", "index");

  for (const entrypoint of [
    "bun",
    "esbuild",
    "farm",
    "next",
    "rolldown",
    "rollup",
    "rspack",
    "turbopack",
    "vite",
    "webpack",
  ]) {
    const mod = REQUIRE_FROM_TEST(
      TestUnpluginRuntime.libPath(entrypoint, "js"),
    );
    assert.equal(typeof mod.default, "function", entrypoint);
  }

  const api = REQUIRE_FROM_TEST(TestUnpluginRuntime.libPath("api", "js"));
  assert.equal(typeof api.resolveOptions, "function");
  assert.equal(typeof api.transformTtsc, "function");
}

/**
 * Asserts that `ttsc` and `unplugin` are externalised in the built output, that
 * no virtual-module shims or workspace-relative paths are inlined, that stale
 * dev-time externals (`diff-match-patch-es`, `magic-string`) have been removed
 * from both `rollup.config.mjs` and the built artifacts, and that the build no
 * longer depends on `rollup-plugin-node-externals` /
 * `rollup-plugin-auto-external`.
 *
 * The externals plugin's v9 calls the ES2025 `RegExp.escape`, so it requires
 * Node 24 and crashes the rollup build on Node 22; the config now derives its
 * external set from package.json instead. Pinning the config free of those
 * imports keeps the build working on Node 22 and blocks the plugin's return.
 */
function assertPackageBuildKeepsRuntimeDependenciesExternal() {
  assert.equal(
    fs.existsSync(TestUnpluginRuntime.libPath("core/transform", "js")),
    true,
  );
  assert.equal(
    fs.existsSync(TestUnpluginRuntime.libPath("core/transform", "mjs")),
    true,
  );
  assert.equal(
    fs.existsSync(TestUnpluginRuntime.libPath("_virtual/index", "js")),
    false,
  );
  assert.equal(
    fs.existsSync(TestUnpluginRuntime.libPath("_virtual/index", "mjs")),
    false,
  );

  const cjs = fs.readFileSync(
    TestUnpluginRuntime.libPath("core/transform", "js"),
    "utf8",
  );
  const esm = fs.readFileSync(
    TestUnpluginRuntime.libPath("core/transform", "mjs"),
    "utf8",
  );
  const cjsCore = fs.readFileSync(
    TestUnpluginRuntime.libPath("core/index", "js"),
    "utf8",
  );
  const esmCore = fs.readFileSync(
    TestUnpluginRuntime.libPath("core/index", "mjs"),
    "utf8",
  );
  const rollupConfig = fs.readFileSync(
    path.resolve(
      INTERNAL_DIR,
      "../../../../packages/unplugin/rollup.config.mjs",
    ),
    "utf8",
  );

  for (const dependency of ["ttsc"]) {
    assert.match(
      cjs,
      new RegExp(`require\\('${escapeRegExp(dependency)}'\\)`),
      dependency,
    );
  }

  assert.match(esm, /from 'ttsc'/);
  assert.match(cjsCore, /require\('unplugin'\)/);
  assert.match(esmCore, /from 'unplugin'/);

  for (const staleExternal of ["diff-match-patch-es", "magic-string"]) {
    const pattern = new RegExp(escapeRegExp(staleExternal));
    assert.doesNotMatch(rollupConfig, pattern);
    for (const output of [cjs, esm, cjsCore, esmCore]) {
      assert.doesNotMatch(output, pattern);
    }
  }

  for (const removedPlugin of [
    "rollup-plugin-node-externals",
    "rollup-plugin-auto-external",
  ]) {
    // Match the import statement, not a bare mention: the config comment names
    // these plugins to explain why externals come from package.json instead.
    assert.doesNotMatch(
      rollupConfig,
      new RegExp(`from ["']${escapeRegExp(removedPlugin)}["']`),
      removedPlugin,
    );
  }

  for (const output of [cjs, esm, cjsCore, esmCore]) {
    assert.doesNotMatch(output, /_virtual|__dirname|packages\/ttsc/);
  }
}

/**
 * Asserts the shared `transformInclude` predicate implements the complete
 * TypeScript source-extension and path-boundary contract.
 */
async function assertSharedAdapterFilter() {
  const { unplugin } = await TestUnpluginRuntime.loadUnpluginApi();
  const raw = unplugin.raw(undefined, {});
  for (const id of ["main.ts", "main.tsx", "main.mts", "main.cts"]) {
    assert.equal(raw.transformInclude?.(id), true, id);
  }
  for (const id of [
    "main.js",
    "main.jsx",
    "main.mjs",
    "main.cjs",
    "main.mtsx",
    "main.ctsx",
    "main.css",
    "main.d.ts",
    "main.d.mts",
    "main.d.cts",
    "main.d.css.ts",
    "node_modules/pkg/main.ts",
    "node_modules/pkg/main.mts",
    "\0virtual.ts",
  ]) {
    assert.equal(raw.transformInclude?.(id), false, id);
  }
}

/** Escapes all regex meta-characters in `value` for use in `new RegExp(...)`. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Asserts that the Next.js adapter chains into a user-provided `webpack`
 * callback rather than replacing it, and that the adapter's own plugin is still
 * appended to `config.plugins`.
 */
async function assertNextAdapterPreservesWebpackHook() {
  const unpluginNext = await TestUnpluginRuntime.loadUnpluginAdapter("next");
  let called = false;
  const next = unpluginNext({
    webpack(config: Record<string, unknown> & { original?: boolean }) {
      called = true;
      config.original = true;
      return config;
    },
  });
  const config = next.webpack?.({ plugins: [] }, {}) as
    | { original?: boolean; plugins?: unknown[] }
    | undefined;
  assert.equal(called, true);
  assert.equal(config?.original, true);
  assert.equal(config?.plugins?.length, 1);
}

export {
  assertAdapterEntrypointsExposeFactories,
  assertAdapterEntrypointsSupportCjsRequire,
  assertAdapterEntrypointsSupportEsmDefaultImport,
  assertNextAdapterPreservesWebpackHook,
  assertPackageBuildKeepsRuntimeDependenciesExternal,
  assertSharedAdapterFilter,
};
