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

/**
 * Asserts a `babelTransformerPath` the config already carried is chained rather
 * than discarded.
 *
 * `withTtsc` sets that one field and used to read nothing, so a project that
 * had configured its own transformer lost it on the line that adopted this
 * package. Everything else survived — the config and its `transformer` are both
 * spread through — which is what made the loss hard to see
 * (samchon/ttsc#1321).
 *
 * `react-native-svg-transformer` is the case that matters, because its whole
 * installation is that single assignment and it is ordinary in React Native and
 * Expo projects. Losing it does not fail the build: `.svg` files are not
 * TypeScript, so the ttsc pass hands them straight to its upstream, and the
 * upstream was the auto-detected Expo default rather than the transformer the
 * project chose. The build succeeds and the SVG components are wrong.
 *
 * The transport matters as much as the decision, so this reads the value back
 * out of `TTSC_METRO_OPTIONS` — the environment variable Metro's workers
 * actually consult — rather than from the returned config.
 */
export async function assertWithTtscChainsAnExistingTransformer(): Promise<void> {
  await withCleanEnv(async () => {
    const { ENV_KEY } = await TestMetroRuntime.loadOptions();
    const { withTtsc } = await TestMetroRuntime.loadIndex();
    const declared = path.join(
      tempProjectRoot(),
      "node_modules",
      "react-native-svg-transformer",
      "index.js",
    );

    const config = withTtsc({
      projectRoot: tempProjectRoot(),
      transformer: { babelTransformerPath: declared },
    });
    assert.equal(
      JSON.parse(process.env[ENV_KEY] as string).upstreamTransformer,
      declared,
      "the transformer the config already named must become the upstream",
    );
    assert.notEqual(
      config.transformer.babelTransformerPath,
      declared,
      "and this package's transformer must be the one Metro loads",
    );

    // An explicit option is the caller saying it outright, so it wins.
    withTtsc(
      {
        projectRoot: tempProjectRoot(),
        transformer: { babelTransformerPath: declared },
      },
      { upstreamTransformer: "explicit-upstream" },
    );
    assert.equal(
      JSON.parse(process.env[ENV_KEY] as string).upstreamTransformer,
      "explicit-upstream",
      "an explicit upstreamTransformer must win over the config's value",
    );

    // A config with nothing declared still auto-detects, which is the whole
    // point of the candidate list.
    withTtsc({ projectRoot: tempProjectRoot() });
    assert.equal(
      JSON.parse(process.env[ENV_KEY] as string).upstreamTransformer,
      undefined,
      "a config with no transformer must still auto-detect",
    );

    // Wrapping twice must not make this transformer its own upstream.
    const once = withTtsc({ projectRoot: tempProjectRoot() });
    const twice = withTtsc(once);
    assert.equal(
      JSON.parse(process.env[ENV_KEY] as string).upstreamTransformer,
      undefined,
      "a doubly wrapped config must not delegate into this package's own transformer",
    );
    assert.equal(
      twice.transformer.babelTransformerPath,
      once.transformer.babelTransformerPath,
      "and the transformer Metro loads is unchanged",
    );
  });
}
