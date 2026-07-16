import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestMetroRuntime } from "./metro-runtime";

/**
 * A real temp-dir `projectRoot` for config passthrough cases: `withTtsc`
 * prepares the snapshot under the project root (falling back to the working
 * directory), so a config without one would write into the suite's own tree.
 */
function tempProjectRoot(): string {
  return TestProject.tmpdir("ttsc-metro-config-");
}

/**
 * Run `body` with `TTSC_METRO_OPTIONS` saved and restored, so config-level env
 * mutations from {@link withTtsc} never leak into sibling test cases.
 */
async function withCleanEnv(body: () => Promise<void>): Promise<void> {
  const { ENV_KEY } = await TestMetroRuntime.loadOptions();
  const previous = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
  try {
    await body();
  } finally {
    if (previous === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previous;
    }
  }
}

/**
 * Asserts `withTtsc` points `transformer.babelTransformerPath` at the package's
 * built transformer module, by absolute path, and that the file exists.
 */
export async function assertWithTtscSetsBabelTransformerPath(): Promise<void> {
  await withCleanEnv(async () => {
    const { withTtsc } = await TestMetroRuntime.loadIndex();
    const config = withTtsc({
      projectRoot: tempProjectRoot(),
      transformer: {},
    });
    const target = config.transformer.babelTransformerPath;
    assert.equal(typeof target, "string");
    assert.equal(path.isAbsolute(target), true);
    assert.match(target, /transformer\.js$/);
    assert.equal(fs.existsSync(target), true);
  });
}

/**
 * Asserts `withTtsc` preserves the rest of the Metro config: unrelated
 * top-level keys and existing `transformer` fields survive untouched while only
 * `babelTransformerPath` is added.
 */
export async function assertWithTtscPreservesExistingConfig(): Promise<void> {
  await withCleanEnv(async () => {
    const { withTtsc } = await TestMetroRuntime.loadIndex();
    const base = {
      projectRoot: tempProjectRoot(),
      resolver: { sourceExts: ["ts", "tsx"] },
      transformer: {
        minifierPath: "metro-minify-terser",
        assetPlugins: ["expo-asset/tools/hashAssetFiles"],
      },
    };
    const config = withTtsc(base);
    assert.equal(config.projectRoot, base.projectRoot);
    assert.deepEqual(config.resolver, base.resolver);
    assert.equal(config.transformer.minifierPath, "metro-minify-terser");
    assert.deepEqual(
      config.transformer.assetPlugins,
      base.transformer.assetPlugins,
    );
    assert.equal(typeof config.transformer.babelTransformerPath, "string");
    // The original object is not mutated in place.
    assert.equal(
      (base.transformer as Record<string, unknown>).babelTransformerPath,
      undefined,
    );
  });
}

/**
 * Asserts `withTtsc` publishes resolved options to the worker env so Metro's
 * transformer processes, which never see the `withTtsc` call, can read them.
 */
export async function assertWithTtscPublishesWorkerEnv(): Promise<void> {
  await withCleanEnv(async () => {
    const { ENV_KEY } = await TestMetroRuntime.loadOptions();
    const { withTtsc } = await TestMetroRuntime.loadIndex();

    const projectRoot = tempProjectRoot();
    withTtsc(
      { projectRoot, transformer: {} },
      { project: "tsconfig.build.json", exclude: ["__tests__"] },
    );
    assert.deepEqual(JSON.parse(process.env[ENV_KEY] as string), {
      project: "tsconfig.build.json",
      exclude: ["__tests__"],
    });

    // No options still publishes an explicit (empty) payload, never undefined.
    withTtsc({ projectRoot, transformer: {} });
    assert.equal(process.env[ENV_KEY], "{}");
  });
}

/**
 * Asserts withTtsc adds a `transformer` block even when the input config has
 * none: spreading an absent `transformer` must not crash and must still yield a
 * valid `babelTransformerPath`, while unrelated top-level keys survive.
 */
export async function assertWithTtscAddsTransformerWhenAbsent(): Promise<void> {
  await withCleanEnv(async () => {
    const { withTtsc } = await TestMetroRuntime.loadIndex();
    const projectRoot = tempProjectRoot();
    const config = withTtsc({ projectRoot });
    assert.equal(config.projectRoot, projectRoot);
    assert.equal(typeof config.transformer.babelTransformerPath, "string");
    assert.match(config.transformer.babelTransformerPath, /transformer\.js$/);
  });
}
