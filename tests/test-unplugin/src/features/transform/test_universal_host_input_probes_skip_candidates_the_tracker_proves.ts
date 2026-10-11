import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import { MISSING_INPUT_STATE } from "../../../../../packages/unplugin/src/core/transform/validation/MISSING_INPUT_STATE";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { matchesUniversalHostInputProbes } from "../../../../../packages/unplugin/src/core/transform/validation/matchesUniversalHostInputProbes";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies absent host inputs a tracker proves unchanged cost no native probe,
 * while every candidate it does not prove is still probed.
 *
 * One input a watch cannot prove, such as a link whose metadata proof stays on
 * the validation path, sent every absent input back to the disk, restating the
 * directory the tracker had just verified (samchon/ttsc#1453).
 *
 * 1. Capture a generation whose two absent inputs share their nearest directory.
 * 2. With a tracker proving both, assert no stat at all.
 * 3. Withdraw one from the tracker: only that candidate and its directory are
 *    stated, and its appearance is still rejected.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual capture and matchesUniversalHostInputProbes run over a real directory through a counting native stat.
 * @evidence contracts/testing.md#independent-expectations The tracker's covered set and the literal stat log set the expectations; a real file created afterwards supplies the appearance.
 * @evidence contracts/testing.md#distinguishing-cases A group proven whole, a partly proven group and an unproven candidate that appeared are separate rows.
 * @evidence contracts/testing.md#execution-ownership Unit test: the real capture and probe owners run on a handwritten generation and a handwritten tracker state; no compiler, watcher or host runs.
 */
export function test_universal_host_input_probes_skip_candidates_the_tracker_proves(): void {
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
  const tracker = (covered: readonly string[]): TtscProjectMutationTracker =>
    ({
      changes: new Set<string>(),
      changesOmitted: false,
      close: () => undefined,
      contentAuthoritative: true,
      covered: new Set(covered),
      failed: false,
      membershipChanged: false,
    }) as unknown as TtscProjectMutationTracker;

  stats.length = 0;
  cached.hostInputMutationTracker = tracker([first, second]);
  assert.equal(matchesUniversalHostInputProbes(cached, validation), true);
  assert.equal(
    stats.length,
    0,
    "a group its tracker proves whole is not stated",
  );

  stats.length = 0;
  cached.hostInputMutationTracker = tracker([first]);
  assert.equal(matchesUniversalHostInputProbes(cached, validation), true);
  assert.ok(stats.includes(second), "the unproven candidate is probed");
  assert.ok(!stats.includes(first), "the proven candidate is not probed");

  fs.writeFileSync(second, "{}");
  assert.equal(
    matchesUniversalHostInputProbes(cached, validation),
    false,
    "an unproven candidate that appeared is still rejected",
  );
}
