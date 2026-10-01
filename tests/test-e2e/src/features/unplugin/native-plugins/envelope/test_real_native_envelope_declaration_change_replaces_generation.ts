import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertProductionEnvelope } from "../../../../internal/unplugin/internal/real-native-envelope/assertProductionEnvelope";
import { createRealNativeEnvelopeFixture } from "../../../../internal/unplugin/internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { deliver } from "../../../../internal/unplugin/internal/real-native-envelope/deliver";
import { loadApi } from "../../../../internal/unplugin/internal/real-native-envelope/loadApi";
import { programRuns } from "../../../../internal/unplugin/internal/real-native-envelope/programRuns";
import { resetRunLog } from "../../../../internal/unplugin/internal/real-native-envelope/resetRunLog";

/**
 * Verifies an edit to a selected declaration replaces the persistent generation
 * before its next importer is delivered.
 *
 * A declaration file is a compiler input the native host proves through the
 * graph. Serving the next importer from the old generation would hand it output
 * computed against a type that no longer exists.
 *
 * 1. Deliver the first module and assert the production envelope.
 * 2. Edit the selected declaration and assert the next delivery recompiles.
 * 3. Deliver the remaining modules and assert they reuse the replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification Deliveries through transformTtsc produce one real Program, then two after the selected external declaration is rewritten; every remaining sibling leaves the count at two. assertProductionEnvelope validates the initial native envelope used by the cache.
 * @evidence contracts/testing.md#independent-expectations A selected declaration is a Program input even when its type-only edge disappears from the bundler graph. The contributor's invocation log and literal counts independently require one replacement and subsequent reuse; this case does not inspect type-dependent output after replacement.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged initial project and unchanged siblings contrast with an edit to the selected node_modules declaration. Candidate appearance and type-root membership changes belong to the adjacent candidate-appearance envelope entry.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this exported test in native-plugins/envelope, and this entry owns the declaration rewrite and subsequent module loop. Actual compiler execution makes it part of the native E2E population.
 * @evidence contracts/e2e.md#necessary-boundary The real native compiler records a selected package declaration and passes its dependency proof to the JS cache. Direct cache calls with a fabricated graph cannot prove that native type-only resolution emitted that input.
 * @evidence contracts/e2e.md#shared-execution One fixture and cache carry initial delivery, declaration invalidation and all remaining siblings. The fixture shares its contributor source and native build cache with other envelope entries; the declaration mutation requires a second Program invocation, rather than another installation or contributor build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture allocates independent project and run-log directories, resets the log before delivery, and changes only its own declaration. Options and contributor identity remain fixed so siblings can reuse the replacement. finally resets the transform cache; runner-owned TestProject directories survive until runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The original native-envelope validation, one-to-two replacement and final two-invocation reuse assertions stay executable here. There is no transfer or removed assertion; synthetic graph cases remain complementary interpretation coverage.
 */
export async function test_real_native_envelope_declaration_change_replaces_generation(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await loadApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(programRuns(fixture.runLog), 1);
    await assertProductionEnvelope(cache, fixture);

    fs.writeFileSync(
      fixture.declaration,
      "export interface Shared { label: string; revision?: number; }\n",
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules[1]!);
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "a selected declaration edit must replace the generation before its next importer is delivered",
    );
    for (const file of fixture.modules.slice(2)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "sibling deliveries must reuse the generation created after the declaration edit",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
