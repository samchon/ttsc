import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { MISSING_INPUT_STATE } from "../../../../../packages/unplugin/src/core/transform/validation/MISSING_INPUT_STATE";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { matchesUniversalHostInputProbes } from "../../../../../packages/unplugin/src/core/transform/validation/matchesUniversalHostInputProbes";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies a missing universal input follows native Unicode alias observations.
 *
 * Case policy does not establish that JavaScript lowercasing describes native
 * normalization rules. Literal stat aliases cover both composed/decomposed
 * names, an ASCII candidate aliased by a non-ASCII entry and an ASCII
 * long/short spelling pair. The native stat result owns existence in every
 * row.
 *
 * 1. Capture missing candidates under both case-sensitive and insensitive
 *    policies.
 * 2. Add an unrelated Unicode name and keep the candidate's absence valid.
 * 3. Add its decomposed alias, reject absence, then remove it and prove recovery.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual captureUniversalHostInputValidation and matchesUniversalHostInputProbes on a literal missing-input generation. Unrelated Unicode creation must preserve absence; native alias appearance must reject it and removal must restore it.
 * @evidence contracts/testing.md#independent-expectations The stat seam redirects only authored composed-to-decomposed, K-to-Kelvin and long-name.config-to-SHORT~1.CONFIG pairs. Literal native stat observations require false on alias appearance and true on absence or unrelated sibling without consulting a production normalizer; the ASCII pair models native short-name equivalence without creating it on this host.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts absent input, unrelated non-ASCII sibling, native alias appearance and removal for Unicode and ASCII requested names under both case policies. Case sensitivity alone cannot certify all native name equivalences.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin runner discovers this synchronous entry. It calls authored validation operations through supported filesystem stat and caseSensitive seams over real temporary directory entries and a handwritten generation. No compiler, installed consumer, watcher or product host runs; the fixture cache is disposed in finally.
 */
export function test_universal_host_input_absence_follows_native_unicode_aliases(): void {
  const failures: Error[] = [];
  for (const sensitive of [false, true])
    for (const [requested, listed] of [
      ["\u00e9.config", "e\u0301.config"],
      ["K.config", "\u212a.config"],
      ["long-name.config", "SHORT~1.CONFIG"],
    ]) {
      try {
        assertNativeAliasAbsence(sensitive, requested!, listed!);
      } catch (cause) {
        failures.push(
          new Error(
            `${sensitive ? "sensitive" : "insensitive"}: ${requested} -> ${listed}`,
            { cause },
          ),
        );
      }
    }
  if (failures.length)
    throw new AggregateError(failures, "Native alias absence scenarios failed");
}

/**
 * Exercises one fresh directory, cache and manifest so policy and spelling rows
 * cannot share identity memos. Literal native stat redirects the requested
 * name; actual directory bytes supply unrelated and aliased listings. Absence
 * and unrelated appearance must remain valid; alias appearance must invalidate
 * and its removal must recover. The exported entry collects every row's
 * failure.
 */
function assertNativeAliasAbsence(
  sensitive: boolean,
  requested: string,
  listed: string,
): void {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const directory = path.join(root, "unicode");
  fs.mkdirSync(directory);
  const candidate = path.join(directory, requested);
  const alias = path.join(directory, listed);
  const unrelated = path.join(directory, "\u00f1.config");
  const cache = createTtscTransformCache({
    caseSensitive: () => sensitive,
    stat: (file) => fs.statSync(file === candidate ? alias : file),
  });
  const filesystem = transformFilesystem(cache);
  const result = {
    ...fixture.good.result,
    hostInputs: [candidate],
    hostInputHashes: { [candidate]: null },
    hostInputRealpaths: { [candidate]: null },
  };
  TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
  const cached = {
    ...fixture.good,
    result,
    externalInputHashes: {} as Record<string, string>,
  };
  const identity =
    envelopeDerivation(cached).identityContext.resolve(candidate).key;
  cached.externalInputHashes[identity] = MISSING_INPUT_STATE;
  try {
    const admitted = captureUniversalHostInputValidation(cached, fixture.file);
    assert.deepEqual(admitted.failures.entries, []);
    assert.ok(
      admitted.validation,
      "native absence can establish a reusable manifest",
    );
    const validation = admitted.validation;
    assert.equal(matchesUniversalHostInputProbes(cached, validation), true);
    fs.writeFileSync(unrelated, "{}");
    assert.equal(
      matchesUniversalHostInputProbes(cached, validation),
      true,
      "an unrelated Unicode sibling leaves the candidate absent",
    );
    fs.writeFileSync(alias, "{}");
    assert.equal(
      matchesUniversalHostInputProbes(cached, validation),
      false,
      "native normalization alias appearance invalidates absence",
    );
    fs.rmSync(alias);
    assert.equal(
      matchesUniversalHostInputProbes(cached, validation),
      true,
      "removing the alias re-establishes native absence",
    );
  } finally {
    fixture.dispose();
  }
}
