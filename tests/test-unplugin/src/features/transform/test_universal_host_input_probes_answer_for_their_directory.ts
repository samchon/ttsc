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
 * Verifies grouped absent host inputs are proven by their candidates' own
 * stats, without restating the directory the tracker already verifies.
 *
 * Each grouped candidate is the first missing component directly below its
 * directory, so ENOENT holds whether the directory stayed or vanished, and
 * ENOTDIR means the directory became a non-directory (samchon/ttsc#1735).
 *
 * 1. Capture a generation whose two absent inputs share their directory.
 * 2. Assert the proof holds with one stat per candidate and none of the directory.
 * 3. Assert it still holds once the directory is removed, rejects once a file
 *    replaces the directory, and rejects once a candidate appears.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual capture and matchesUniversalHostInputProbes run over a real directory through a recording native stat.
 * @evidence contracts/testing.md#independent-expectations Literal candidate paths, real removal, replacement and creation, and the recorded stat log set every expectation.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged directory, a vanished one, one replaced by a file and an appeared candidate are separate rows.
 * @evidence contracts/testing.md#execution-ownership Unit test: the real capture and probe owners run on a handwritten generation; no compiler, watcher or host runs.
 */
export function test_universal_host_input_probes_answer_for_their_directory(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const directory = path.join(root, "absent-inputs");
  const first = path.join(directory, "first.json");
  const second = path.join(directory, "second.json");
  fs.mkdirSync(directory);
  const stats: string[] = [];
  const cache = createTtscTransformCache({
    stat: (file) => {
      stats.push(path.resolve(file));
      return fs.statSync(file);
    },
  });
  const filesystem = transformFilesystem(cache);
  const result = {
    ...fixture.good.result,
    hostInputs: [first, second],
    hostInputHashes: { [first]: null, [second]: null },
    hostInputRealpaths: { [first]: null, [second]: null },
  };
  TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
  const cached = {
    ...fixture.good,
    result,
    externalInputHashes: {} as Record<string, string>,
  };
  const identities = envelopeDerivation(cached).identityContext;
  for (const input of [first, second])
    cached.externalInputHashes[identities.resolve(input).key] =
      MISSING_INPUT_STATE;
  const validation = captureUniversalHostInputValidation(
    cached,
    fixture.file,
  ).validation;
  assert.ok(validation, "both absences are reusable");
  assert.equal(validation.missing.size, 1, "the absences share one group");

  stats.length = 0;
  assert.equal(matchesUniversalHostInputProbes(cached, validation), true);
  assert.deepEqual(
    [...stats].sort(),
    [first, second].sort(),
    "each candidate is stated once and the directory not at all",
  );

  fs.rmSync(directory, { recursive: true });
  assert.equal(
    matchesUniversalHostInputProbes(cached, validation),
    true,
    "a vanished directory keeps its candidates unreachable",
  );

  fs.writeFileSync(directory, "a file where the directory was");
  assert.equal(
    matchesUniversalHostInputProbes(cached, validation),
    false,
    "a directory replaced by a file rejects the grouped proof",
  );

  fs.rmSync(directory);
  fs.mkdirSync(directory);
  fs.writeFileSync(second, "{}");
  assert.equal(
    matchesUniversalHostInputProbes(cached, validation),
    false,
    "an appeared candidate rejects the proof",
  );
}
