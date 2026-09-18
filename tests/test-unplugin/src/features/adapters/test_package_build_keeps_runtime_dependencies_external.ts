import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const INTERNAL_DIR = path.join(
  TestProject.WORKSPACE_ROOT,
  "tests",
  "test-unplugin",
  "src",
  "internal",
);

/**
 * Verifies that `ttsc` and `unplugin` are externalised in the built output,
 * that no virtual-module shims or workspace-relative paths are inlined, that
 * stale dev-time externals (`diff-match-patch-es`, `magic-string`) have been
 * removed from both `rollup.config.mjs` and the built artifacts, and that the
 * build no longer depends on `rollup-plugin-node-externals` /
 * `rollup-plugin-auto-external`.
 *
 * The externals plugin's v9 calls the ES2025 `RegExp.escape`, so it requires
 * Node 24 and crashes the rollup build on Node 22; the config now derives its
 * external set from package.json instead. Pinning the config free of those
 * imports keeps the build working on Node 22 and blocks the plugin's return.
 */
export async function test_package_build_keeps_runtime_dependencies_external(): Promise<void> {
  assert.equal(
    fs.existsSync(
      TestUnpluginRuntime.libPath(
        "core/transform/generation/captureTransformGeneration",
        "js",
      ),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      TestUnpluginRuntime.libPath(
        "core/transform/generation/captureTransformGeneration",
        "mjs",
      ),
    ),
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
    TestUnpluginRuntime.libPath(
      "core/transform/generation/captureTransformGeneration",
      "js",
    ),
    "utf8",
  );
  const esm = fs.readFileSync(
    TestUnpluginRuntime.libPath(
      "core/transform/generation/captureTransformGeneration",
      "mjs",
    ),
    "utf8",
  );
  const cjsCore = fs.readFileSync(
    TestUnpluginRuntime.libPath("core/unplugin", "js"),
    "utf8",
  );
  const esmCore = fs.readFileSync(
    TestUnpluginRuntime.libPath("core/unplugin", "mjs"),
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

/** Escapes all regex meta-characters in `value` for use in `new RegExp(...)`. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
