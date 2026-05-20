import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Asserts that `transformTtsc` uses an explicit absolute `project` path instead
 * of auto-discovering `tsconfig.json`, allowing the adapter to point at a
 * bundler-specific tsconfig.
 */
async function assertTransformUsesProjectOption() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  writeUnpluginProject(root);

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      project: path.join(root, "tsconfig.unplugin.json"),
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}

/**
 * Asserts that a relative `project` path in `resolveOptions` is resolved
 * against `process.cwd()`, not the file being transformed.
 *
 * Temporarily changes `process.cwd()` to the project root and restores it in a
 * `finally` block to avoid polluting subsequent tests.
 */
async function assertTransformUsesRelativeProjectOption() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  writeUnpluginProject(root);

  const cwd = process.cwd();
  process.chdir(root);
  try {
    const result = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      resolveOptions({
        project: "tsconfig.unplugin.json",
      }),
    );

    assert.ok(result);
    assert.match(result.code, /"PLUGIN"/);
  } finally {
    process.chdir(cwd);
  }
}

/**
 * Writes `tsconfig.unplugin.json` at `root`, extending `tsconfig.json` with the
 * fixture plugin. Used by both `assertTransformUsesProjectOption` and
 * `assertTransformUsesRelativeProjectOption`.
 */
function writeUnpluginProject(root: string): void {
  fs.writeFileSync(
    path.join(root, "tsconfig.unplugin.json"),
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

export {
  assertTransformUsesProjectOption,
  assertTransformUsesRelativeProjectOption,
  writeUnpluginProject,
};
