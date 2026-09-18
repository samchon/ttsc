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
