import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { matchesUniversalHostInputProbes } from "../../../../../packages/unplugin/src/core/transform/validation/matchesUniversalHostInputProbes";
import { MISSING_INPUT_STATE } from "../../../../../packages/unplugin/src/core/transform/validation/MISSING_INPUT_STATE";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies exact native absence survives unknown directory case policy.
 *
 * An empty directory supplies no read-only spelling evidence, but native stat
 * can still answer the exact candidate the compiler observed. Unknown policy
 * must withdraw the listing shortcut without withdrawing this stronger proof.
 *
 * 1. Capture a literal missing-input generation through actual native stat.
 * 2. Keep it absent, then create a file, directory and differently cased name.
 * 3. Refuse native stat with permission and I/O errors and reject those proofs.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual captureUniversalHostInputValidation admits a direct exact-path absence probe with unknown case policy, and matchesUniversalHostInputProbes preserves absence but rejects file or directory appearance and unavailable native reads.
 * @evidence contracts/testing.md#independent-expectations Native ENOENT and ENOTDIR establish absence independently of the product; real filesystem creation establishes appearance. An independent native stat of the differently cased path supplies its platform-specific result, while literal EACCES and EIO are observation failures rather than missing paths.
 * @evidence contracts/testing.md#distinguishing-cases Unknown-case missing candidates contrast with exact file and directory appearances, native case aliases, permission failure and transient I/O failure. The admitted manifest must carry exact spelling in directMissing and no case-folded listing group; both capture and reuse must reject unavailable observations.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls real admission and validation operations over literal consumer generation metadata and a tracked fixture filesystem, with injected read-only capability failure. It launches no compiler, installer or product host; native generation publication remains in the surviving transform E2E cases.
 */
export function test_universal_host_input_probes_record_exact_missing_candidates(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const directory = path.join(root, "empty");
  const candidate = path.join(directory, "candidate.json");
  fs.mkdirSync(directory);
  let failure: "EACCES" | "EIO" | undefined;
  const cache = createTtscTransformCache({
    caseSensitive: () => undefined,
    stat: (file) => {
      if (file === candidate && failure !== undefined) {
        throw Object.assign(new Error("native observation refused"), { code: failure });
      }
      return fs.statSync(file);
    },
  });
  const filesystem = transformFilesystem(cache);
  const result = {
    ...fixture.good.result,
    hostInputs: [candidate],
    hostInputHashes: { [candidate]: null },
    hostInputRealpaths: { [candidate]: null },
  };
  TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
  const cached = { ...fixture.good, result, externalInputHashes: {} as Record<string, string> };
  const identity = envelopeDerivation(cached).identityContext.resolve(candidate).key;
  cached.externalInputHashes[identity] = MISSING_INPUT_STATE;
  const capture = () => captureUniversalHostInputValidation(cached, fixture.file);
  try {
    const admitted = capture();
    assert.deepEqual(admitted.failures.entries, []);
    const validation = admitted.validation;
    assert.ok(validation, "exact native absence remains reusable");
    assert.deepEqual([...validation.directMissing!], [candidate]);
    assert.equal(validation.missing.size, 0, "unknown case never authorizes listing normalization");
    assert.equal(matchesUniversalHostInputProbes(cached, validation), true);
    fs.writeFileSync(candidate, "{}");
    assert.equal(matchesUniversalHostInputProbes(cached, validation), false, "file appeared");
    fs.rmSync(candidate);
    fs.mkdirSync(candidate);
    assert.equal(matchesUniversalHostInputProbes(cached, validation), false, "directory appeared");
    fs.rmdirSync(candidate);
    const alternate = path.join(directory, "CANDIDATE.json");
    fs.writeFileSync(alternate, "{}");
    let nativeAbsent = false;
    try { fs.statSync(candidate); }
    catch (error) { nativeAbsent = (error as NodeJS.ErrnoException).code === "ENOENT"; }
    assert.equal(matchesUniversalHostInputProbes(cached, validation), nativeAbsent, "native alias semantics");
    fs.rmSync(alternate);
    fs.rmdirSync(directory);
    fs.writeFileSync(directory, "blocks descendants");
    assert.equal(matchesUniversalHostInputProbes(cached, validation), true, "ENOTDIR keeps the exact candidate absent");
    fs.rmSync(directory);
    fs.mkdirSync(directory);
    for (const code of ["EACCES", "EIO"] as const) {
      failure = code;
      assert.equal(matchesUniversalHostInputProbes(cached, validation), false, code);
      assert.equal(capture().validation, undefined, code + " cannot admit exact absence");
    }
    failure = undefined;
    assert.ok(capture().validation, "native recovery re-establishes absence");
  } finally {
    fixture.dispose();
  }
}
