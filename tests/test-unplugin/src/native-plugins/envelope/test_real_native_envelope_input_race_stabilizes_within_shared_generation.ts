import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { samePhysicalPath } from "../../internal/paths/samePhysicalPath";
import { assertProductionEnvelope } from "../../internal/real-native-envelope/assertProductionEnvelope";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { deliver } from "../../internal/real-native-envelope/deliver";
import { loadApi } from "../../internal/real-native-envelope/loadApi";
import { programRuns } from "../../internal/real-native-envelope/programRuns";
import { resetRunLog } from "../../internal/real-native-envelope/resetRunLog";

/**
 * Verifies wrapper-state and compiler-input races stabilize within bounded
 * attempts and one shared generation.
 *
 * A config inherited by the generated wrapper can change after the wrapper is
 * written, and a compiler input can change between attempts. A delivery must
 * discard the mixed wrapper state and retry once, and concurrent modules must
 * share that failed attempt and its stable retry rather than each starting
 * their own.
 *
 * 1. Race a replacement of the inherited config after wrapper materialization, and
 *    an input change across attempts.
 * 2. Assert a delivery discards the mixed state and retries once.
 * 3. Deliver modules concurrently and assert they share the failed attempt and the
 *    stable retry, and later modules reuse that generation.
 *
 * @evidence contracts/testing.md#behavioral-verification transformTtsc discards an inherited-config race after wrapper materialization, produces output in two attempts, then concurrent modules share a declaration race and its stable retry. Assertions require both mutations to occur, two invocation-log bytes, complete snapshot, one cache entry, and the same stable Promise on later deliveries.
 * @evidence contracts/testing.md#independent-expectations The filesystem hook and contributor mutation deliberately change inputs at specified boundaries. Literal attempt counts and stable Promise identity require a coherent replacement without deriving expected values from cache validation. assertProductionEnvelope calibrates against actual native graph fields; output type semantics are outside this race oracle.
 * @evidence contracts/testing.md#distinguishing-cases The first phase has no supplied cache and races an inherited config after wrapper creation. The second resets the contributor attempt marker and run log, races a declaration under concurrent cached requests, then checks unchanged sequential deliveries reuse that stabilized generation.
 * @evidence contracts/testing.md#execution-ownership The exported native envelope entry owns both race phases and its concurrent module callbacks. TestExecutor discovers the entry in the native E2E lane; callbacks are accounted for through their owning entry rather than separate tests.
 * @evidence contracts/e2e.md#necessary-boundary The generated wrapper, real compiler's input capture and native ApplyProgram hook meet the JS concurrent cache. This detects a mixed wrapper or compile snapshot that an isolated validator receiving a finished synthetic envelope cannot expose.
 * @evidence contracts/e2e.md#shared-execution Both phases use one real fixture and shared contributor artifact. The cache-optional and cached phases require separate captures because they test different ownership paths; within the cached phase all modules share one failed attempt and one retry. Later modules reuse the completed generation without native work.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The writeFileSync patch is restored in finally before the concurrent phase. Resetting raceAttempt and runLog creates a fresh actual race despite shared contributor code; unique fixture paths prevent other entries mutating these inputs. The cache is reset in finally, and TestProject owns directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage The wrapper-race occurrence, two-attempt counts, declaration revision, complete snapshot, real envelope and stable-generation identity assertions all remain in this entry. No coverage is transferred; concurrency and the cache-optional connection both remain actual native executions.
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
      // The wrapper extends the leaf as the compiler spells it, physically
      // (samchon/ttsc#1456), while the fixture names it through the temporary
      // directory's link on macOS.
      if (
        typeof extended !== "string" ||
        !samePhysicalPath(extended, leafConfig)
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
