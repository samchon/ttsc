import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
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
 * resolve to a callable factory function.
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
 * no virtual-module shims or workspace-relative paths are inlined, and that
 * stale dev-time externals (`diff-match-patch-es`, `magic-string`) have been
 * removed from both `rollup.config.mjs` and the built artifacts.
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

  for (const output of [cjs, esm, cjsCore, esmCore]) {
    assert.doesNotMatch(output, /_virtual|__dirname|packages\/ttsc/);
  }
}

/**
 * Asserts the shared `transformInclude` predicate accepts `.ts`/`.tsx` source
 * files and rejects `.js`, `.jsx`, `.css`, `node_modules` paths, `.d.ts`
 * declarations, and virtual-module IDs (prefix `\0`).
 */
async function assertSharedAdapterFilter() {
  const { unplugin } = await TestUnpluginRuntime.loadUnpluginApi();
  const raw = unplugin.raw(undefined, {});
  assert.equal(raw.transformInclude?.("main.ts"), true);
  assert.equal(raw.transformInclude?.("main.tsx"), true);
  assert.equal(raw.transformInclude?.("main.js"), false);
  assert.equal(raw.transformInclude?.("main.jsx"), false);
  assert.equal(raw.transformInclude?.("main.css"), false);
  assert.equal(raw.transformInclude?.("node_modules/pkg/main.ts"), false);
  assert.equal(raw.transformInclude?.("main.d.ts"), false);
  assert.equal(raw.transformInclude?.("\0rolldown/runtime.js"), false);
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
