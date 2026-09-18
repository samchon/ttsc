import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertProductionEnvelope } from "../../internal/real-native-envelope/assertProductionEnvelope";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { deliver } from "../../internal/real-native-envelope/deliver";
import { loadApi } from "../../internal/real-native-envelope/loadApi";
import { programRuns } from "../../internal/real-native-envelope/programRuns";
import { resetRunLog } from "../../internal/real-native-envelope/resetRunLog";

/**
 * Assert wrapper-state and compiler-input races stabilize in bounded
 * lifecycles.
 */
export async function test_real_native_envelope_input_race_stabilizes_within_shared_generation(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture({
    raceInputsAcrossAttempts: true,
  });
  const api = await loadApi();
  const options = api.resolveOptions({
    compilerOptions: { strict: true },
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  const leafConfig = path.join(fixture.root, "tsconfig.json");
  const baseConfig = path.join(fixture.root, "presets", "base.json");
  const originalWriteFileSync = fs.writeFileSync;
  let configRaced = false;
  Object.defineProperty(fs, "writeFileSync", {
    configurable: true,
    value: ((...args: unknown[]): unknown => {
      const output = Reflect.apply(originalWriteFileSync, fs, args);
      const [file, contents] = args;
      if (
        configRaced ||
        typeof file !== "string" ||
        typeof contents !== "string" ||
        path.basename(file) !== "tsconfig.json" ||
        path.resolve(file) === path.resolve(leafConfig)
      ) {
        return output;
      }
      let extended: unknown;
      try {
        extended = (JSON.parse(contents) as { extends?: unknown }).extends;
      } catch {
        return output;
      }
      if (
        typeof extended !== "string" ||
        path.resolve(extended) !== path.resolve(leafConfig)
      ) {
        return output;
      }
      configRaced = true;
      originalWriteFileSync(
        baseConfig,
        JSON.stringify({
          compilerOptions: {
            outDir: "${configDir}\\src\\generated-next",
            rootDir: "${configDir}",
          },
        }),
        "utf8",
      );
      return output;
    }) as typeof fs.writeFileSync,
    writable: true,
  });
  try {
    assert.ok(
      await api.transformTtsc(
        fixture.modules[0]!,
        fs.readFileSync(fixture.modules[0]!, "utf8"),
        options,
        undefined,
        undefined,
      ),
    );
  } finally {
    Object.defineProperty(fs, "writeFileSync", {
      configurable: true,
      value: originalWriteFileSync,
      writable: true,
    });
  }
  assert.equal(
    configRaced,
    true,
    "the fixture must replace the inherited config after wrapper materialization",
  );
  assert.equal(
    programRuns(fixture.runLog),
    2,
    "a cache-optional delivery must discard the mixed wrapper state and retry once",
  );
  assert.match(fs.readFileSync(baseConfig, "utf8"), /generated-next/);

  const parsed = JSON.parse(fs.readFileSync(leafConfig, "utf8")) as {
    compilerOptions: { plugins: Array<Record<string, unknown>> };
  };
  parsed.compilerOptions.plugins[0]!.raceAttempt = 0;
  fs.writeFileSync(leafConfig, JSON.stringify(parsed, null, 2), "utf8");
  resetRunLog(fixture.runLog);

  const cache = api.createTtscTransformCache();
  try {
    await Promise.all(
      fixture.modules.map((file) =>
        api.transformTtsc(
          file,
          fs.readFileSync(file, "utf8"),
          options,
          undefined,
          cache,
        ),
      ),
    );
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "concurrent modules must share the failed declaration attempt and its stable retry",
    );
    assert.match(fs.readFileSync(fixture.declaration, "utf8"), /revision/);
    assert.equal(cache.size, 1);
    const stableGeneration = [...cache.values()][0]!;
    assert.equal((await stableGeneration).projectSnapshotComplete, true);
    await assertProductionEnvelope(cache, fixture);

    for (const file of fixture.modules) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "every later module must reuse only the stabilized native generation",
    );
    assert.equal([...cache.values()][0], stableGeneration);
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
