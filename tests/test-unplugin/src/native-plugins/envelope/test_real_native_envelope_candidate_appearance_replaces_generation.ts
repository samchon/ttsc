import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertProductionEnvelope } from "../../internal/real-native-envelope/assertProductionEnvelope";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { deliver } from "../../internal/real-native-envelope/deliver";
import { loadApi } from "../../internal/real-native-envelope/loadApi";
import { programRuns } from "../../internal/real-native-envelope/programRuns";
import { resetRunLog } from "../../internal/real-native-envelope/resetRunLog";

/** Assert a newly available superseding candidate replaces one generation. */
export async function test_real_native_envelope_candidate_appearance_replaces_generation(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture({ resolutionCorpus: true });
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
      fixture.missingCandidate,
      'export const linked = "typescript";\n',
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules[1]!);
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "a superseding package candidate must replace the generation before its next importer is delivered",
    );
    for (const file of fixture.modules.slice(2, -1)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "sibling deliveries must reuse the generation created after candidate appearance",
    );

    fs.rmSync(fixture.fileCandidateDirectory, { recursive: true });
    fs.writeFileSync(
      fixture.fileCandidateDirectory,
      "exports.encode = function encode(value) { return `file:${value}`; };\n",
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules.at(-1)!);
    assert.equal(
      programRuns(fixture.runLog),
      3,
      "replacing a failed file-candidate directory with a selectable file must replace the generation",
    );

    const generatedTypes = path.join(
      fixture.automaticTypesDirectory,
      "generated-ambient",
    );
    fs.mkdirSync(generatedTypes, { recursive: true });
    fs.writeFileSync(
      path.join(generatedTypes, "index.d.ts"),
      "declare const generatedAmbient: string;\n",
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(
      programRuns(fixture.runLog),
      4,
      "adding an automatic type package must replace the generation before a bundler can reuse it",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
