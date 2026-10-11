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
 * Verifies grouped absent host inputs skip their directory's stat only when the
 * admission's location verification already read its identity.
 *
 * A candidate's own stat cannot say whether its directory is still one, since
 * Windows answers ENOENT below a file just as below nothing, so the directory
 * is stated unless the same synchronous admission read it (samchon/ttsc#1735).
 *
 * 1. Capture a generation whose two absent inputs share a directory.
 * 2. Assert the proof states the directory without an admission identity, and only
 *    the candidates with one.
 * 3. Assert it holds once the directory is removed, rejects once a file replaces
 *    the directory, and rejects once a candidate appears.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual capture and matchesUniversalHostInputProbes run over a real directory through a recording native stat.
 * @evidence contracts/testing.md#independent-expectations Literal candidate names, real removal, replacement and creation, and the recorded stat log set every expectation.
 * @evidence contracts/testing.md#distinguishing-cases No admission identity, a read identity, a vanished directory, one replaced by a file and an appeared candidate are separate rows.
 * @evidence contracts/testing.md#execution-ownership Unit test: the real capture and probe owners run on a handwritten generation and transaction; no compiler, watcher or host runs.
 */
export function test_universal_host_input_probes_reuse_the_admission_directory_identity(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const directory = path.join(root, "absent-inputs");
  const first = path.join(directory, "first.json");
  const second = path.join(directory, "second.json");
  fs.mkdirSync(directory);
  // A named entry lets a POSIX volume measure the directory's case policy,
  // which grouping requires; an empty directory keeps exact probes instead.
  fs.writeFileSync(path.join(directory, "present.json"), "{}");
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
  const group = [...validation.missing.keys()][0]!;
  const candidates = [
    path.join(group, "first.json"),
    path.join(group, "second.json"),
  ];

  stats.length = 0;
  assert.equal(matchesUniversalHostInputProbes(cached, validation), true);
  assert.deepEqual(
    [...stats].sort(),
    [group, ...candidates].sort(),
    "without an admission identity the directory is stated once",
  );

  stats.length = 0;
  const proof = { cached, locations: new Map([[group, "1:2"]]) };
  assert.equal(
    matchesUniversalHostInputProbes(cached, validation, proof),
    true,
  );
  assert.deepEqual(
    [...stats].sort(),
    [...candidates].sort(),
    "an identity the admission read stands for the directory's stat",
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
