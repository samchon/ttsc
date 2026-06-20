import assert from "node:assert/strict";

import { TestMetroRuntime } from "./metro-runtime";

/**
 * Run `body` with `TTSC_METRO_OPTIONS` set to `raw` (or cleared when
 * `undefined`) and always restore the previous value afterwards.
 */
async function withEnv(
  raw: string | undefined,
  body: (mod: any) => Promise<void>,
): Promise<void> {
  const mod = await TestMetroRuntime.loadOptions();
  const previous = process.env[mod.ENV_KEY];
  if (raw === undefined) {
    delete process.env[mod.ENV_KEY];
  } else {
    process.env[mod.ENV_KEY] = raw;
  }
  try {
    await body(mod);
  } finally {
    if (previous === undefined) {
      delete process.env[mod.ENV_KEY];
    } else {
      process.env[mod.ENV_KEY] = previous;
    }
  }
}

/**
 * Asserts every option survives the config-process → worker-process env
 * round-trip intact: the ttsc overlay (project/compilerOptions/plugins) plus
 * the Metro-specific include/exclude/upstreamTransformer.
 */
export async function assertOptionsRoundTripThroughEnv(): Promise<void> {
  const source = {
    project: "tsconfig.json",
    compilerOptions: { strict: true },
    plugins: [{ transform: "typia/lib/transform" }],
    include: ["src"],
    exclude: ["test"],
    upstreamTransformer: "custom-upstream",
  };
  const mod = await TestMetroRuntime.loadOptions();
  await withEnv(mod.serializeOptions(source), async (m) => {
    const resolved = m.resolveOptionsFromEnv();
    assert.equal(resolved.ttsc.project, source.project);
    assert.deepEqual(resolved.ttsc.compilerOptions, source.compilerOptions);
    assert.deepEqual(resolved.ttsc.plugins, source.plugins);
    assert.deepEqual(resolved.include, source.include);
    assert.deepEqual(resolved.exclude, source.exclude);
    assert.equal(resolved.upstreamTransformer, source.upstreamTransformer);
  });
}

/**
 * Asserts that with no env payload the resolver falls back to defaults: no
 * project/plugin overrides (so the transformer auto-discovers tsconfig) and
 * empty include/exclude. This is the `withTtsc(config)` no-options path.
 */
export async function assertOptionsDefaultWhenEnvAbsent(): Promise<void> {
  await withEnv(undefined, async (mod) => {
    const resolved = mod.resolveOptionsFromEnv();
    assert.equal(resolved.ttsc.project, undefined);
    assert.equal(resolved.ttsc.plugins, undefined);
    assert.equal(resolved.upstreamTransformer, undefined);
    assert.deepEqual(resolved.include, []);
    assert.deepEqual(resolved.exclude, []);
  });
}

/**
 * Asserts `plugins: false` survives the round-trip as `false`, not `undefined`.
 *
 * The negative twin of the round-trip test: a falsy guard would silently turn
 * "disable all project plugins" back into "auto-read project plugins", so the
 * resolver must preserve the explicit `false`.
 */
export async function assertOptionsPreservePluginsFalse(): Promise<void> {
  const mod = await TestMetroRuntime.loadOptions();
  await withEnv(mod.serializeOptions({ plugins: false }), async (m) => {
    const resolved = m.resolveOptionsFromEnv();
    assert.equal(resolved.ttsc.plugins, false);
  });
}

/**
 * Asserts a malformed env payload degrades to defaults instead of throwing, so
 * a corrupted variable never crashes every Metro worker.
 */
export async function assertOptionsFallBackOnMalformedEnv(): Promise<void> {
  await withEnv("{ not valid json", async (mod) => {
    const resolved = mod.resolveOptionsFromEnv();
    assert.equal(resolved.ttsc.project, undefined);
    assert.equal(resolved.upstreamTransformer, undefined);
    assert.deepEqual(resolved.include, []);
    assert.deepEqual(resolved.exclude, []);
  });
}
