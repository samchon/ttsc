import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertProductionEnvelope } from "../../../internal/real-native-envelope/assertProductionEnvelope";
import { createRealNativeEnvelopeFixture } from "../../../internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { deliver } from "../../../internal/real-native-envelope/deliver";
import { loadApi } from "../../../internal/real-native-envelope/loadApi";
import { programRuns } from "../../../internal/real-native-envelope/programRuns";
import { resetRunLog } from "../../../internal/real-native-envelope/resetRunLog";

/**
 * Verifies a superseding resolution candidate that appears replaces the
 * generation before its next importer is delivered.
 *
 * The real native host reports the absent candidates its resolver probed. When
 * one appears, the program resolves differently, so the next delivery must
 * replace the generation rather than serve a module compiled against the old
 * resolution. Siblings must then reuse the replacement.
 *
 * 1. Deliver the first module of the resolution fixture and assert the production
 *    envelope.
 * 2. Create the superseding package candidate and assert the next delivery
 *    recompiles, while siblings reuse the replacement.
 * 3. Replace a failed candidate directory with a file, and add an automatic type
 *    package, and assert each replaces the generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Real transform deliveries count native ApplyProgram invocations: candidate creation changes one compile to two, siblings keep two, a directory becoming a file requires three, and a new automatic type package requires four. The production envelope is inspected before mutation.
 * @evidence contracts/testing.md#independent-expectations Resolution changes and automatic ambient-type discovery require a fresh Program independently of the adapter's cache algorithm. A contributor appends one byte per Program invocation; literal counts measure reuse and replacement without calculating the cache's decision. Output semantics after each change are not asserted here.
 * @evidence contracts/testing.md#distinguishing-cases The baseline has an absent superseding TypeScript candidate; its appearance, a failed file candidate changing from directory to file, and an automatic type package appearing each replace the generation. Unchanged sibling deliveries form the reuse control; selected-declaration edits have their separate envelope entry.
 * @evidence contracts/testing.md#execution-ownership The named native-plugins/envelope entry is discovered by TestExecutor in the native population. Its module loop belongs to this entry and preserves the compile-count checks across the real resolution corpus.
 * @evidence contracts/e2e.md#necessary-boundary TypeScript-Go resolves actual package candidates and reports its Program graph to the public JS transform cache. A synthetic graph can test interpretation but cannot establish that native resolution reported these absent candidates or type-root membership.
 * @evidence contracts/e2e.md#shared-execution createRealNativeEnvelopeFixture reuses its materialized contributor source and the suite's native build cache. One project, options and transform cache serve the initial compile, three required invalidations and every sibling delivery; the resolutionCorpus option supplies the larger real resolver corpus without another installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique project and run-log roots isolate the candidate and type-directory mutations. resetRunLog starts the observed count at zero; unchanged siblings intentionally share the current generation, and each mutation precedes the delivery that must reject it. finally resets the cache and releases its trackers; TestProject owns temporary directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original envelope, invocation-count and sibling-reuse assertions remain in this entry. No case was transferred or removed; real candidate reporting remains E2E even where synthetic cache tests own the interpretation branches.
 */
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
