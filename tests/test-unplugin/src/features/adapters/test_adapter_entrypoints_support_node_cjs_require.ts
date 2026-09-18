import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
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

/**
 * Verifies every CommonJS entrypoint loads through `require()` and exposes its
 * adapter.
 *
 * A CommonJS consumer resolves the package through `require`, so each built
 * `.js` entry has to load in that context and publish a callable default
 * export. The public `api` entry must also expose `resolveOptions` and
 * `transformTtsc`, which direct callers and `@ttsc/metro` use.
 *
 * 1. Create a `require` rooted at the test package, the context a CommonJS
 *    consumer resolves from.
 * 2. Require the root index and every adapter entry, and assert each default
 *    export is a function.
 * 3. Require `api` and assert `resolveOptions` and `transformTtsc` are functions.
 */
export async function test_adapter_entrypoints_support_node_cjs_require(): Promise<void> {
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
