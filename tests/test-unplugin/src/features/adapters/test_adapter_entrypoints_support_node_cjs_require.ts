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
 * Verifies that all CJS entrypoints are resolvable via `require()` and that the
 * public `api` module exposes `resolveOptions` and `transformTtsc`.
 *
 * Uses a `createRequire` rooted at the test-unplugin package to simulate the
 * resolution context of a CJS consumer.
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
