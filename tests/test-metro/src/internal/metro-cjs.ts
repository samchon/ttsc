import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { TestMetroRuntime } from "./metro-runtime";

const nodeRequire = createRequire(import.meta.url);

/**
 * Asserts the CommonJS build (the one Metro actually `require()`s) loads and
 * runs.
 *
 * Every other test loads the `.mjs` (ESM) build, where `import.meta.url` is
 * native. But `transformer.babelTransformerPath` points at the CJS
 * `transformer.js`, and Metro loads it with `require`. There, both
 * `fileURLToPath(import.meta.url)` (index) and `createRequire(import.meta.url)`
 * (transformer/upstream, plus `packageVersion`'s `require` of the package.json)
 * rely entirely on Rollup's CJS `import.meta.url` rewrite. If that rewrite ever
 * broke, the ESM-only tests would stay green while real Metro crashed at worker
 * load. This pins the production load path:
 *
 * 1. `require` the CJS `index.js` and call `withTtsc` (exercises the index
 *    `import.meta.url` → `pathToFileURL(__filename)` shim).
 * 2. `require` the CJS `transformer.js` (its top-level `createRequire` runs) and
 *    assert callable `transform`/`getCacheKey` exports.
 * 3. Run `getCacheKey` through the CJS module (exercises `packageVersion` and
 *    upstream resolution, both via the CJS shim) and assert a valid digest.
 */
export async function assertCjsBuildLoadsAndRuns(): Promise<void> {
  const optionsModule = nodeRequire(
    TestMetroRuntime.libPath("core/options", "js"),
  );
  const envKey: string = optionsModule.ENV_KEY;
  const previous = process.env[envKey];
  try {
    const index = nodeRequire(TestMetroRuntime.libPath("index", "js"));
    assert.equal(typeof index.withTtsc, "function");
    // A real temp-dir projectRoot keeps the snapshot preparation out of the
    // suite's own working directory.
    const config = index.withTtsc({
      projectRoot: TestProject.tmpdir("ttsc-metro-cjs-"),
      transformer: {},
    });
    assert.match(config.transformer.babelTransformerPath, /transformer\.js$/);

    const transformer = nodeRequire(
      TestMetroRuntime.libPath("transformer", "js"),
    );
    assert.equal(typeof transformer.transform, "function");
    assert.equal(typeof transformer.getCacheKey, "function");

    process.env[envKey] = optionsModule.serializeOptions({
      upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
    });
    const key = transformer.getCacheKey({ projectRoot: "/a" });
    assert.equal(typeof key, "string");
    assert.equal(key.length, 64);
  } finally {
    if (previous === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = previous;
    }
  }
}
