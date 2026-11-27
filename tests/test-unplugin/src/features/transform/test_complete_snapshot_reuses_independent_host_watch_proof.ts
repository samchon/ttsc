import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { TtscGenerationProof } from "../../../../../packages/unplugin/src/core/transform/validation/TtscGenerationProof";
import { matchesCompleteInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/matchesCompleteInputSnapshot";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies that complete snapshot validation can reuse independently qualified
 * external-input proof from the host watcher during a grouped delivery.
 *
 * 1. Record a real declaration outside the project walk and supply exact host
 *    coverage for it in the grouped delivery transaction.
 * 2. Confirm the complete snapshot does not read its metadata or realpath.
 * 3. Withdraw the host proof, edit the declaration, and require direct rejection.
 *
 * @evidence contracts/testing.md#behavioral-verification The production complete-snapshot validator checks an observed on-disk generation with an independent tracker DTO and a current grouped transaction.
 * @evidence contracts/testing.md#independent-expectations Native read counters have an authored zero bound for the covered spelling. Editing the original declaration supplies an independent mismatch.
 * @evidence contracts/testing.md#distinguishing-cases The same spelling contrasts qualified silence, a transaction without grouped reuse, and a watcher gap followed by an actual content change.
 * @evidence contracts/testing.md#execution-ownership One source unit uses a cache-local filesystem view. Its literal tracker supplies authority inputs and does not claim a native watcher produced them. The fixture owns and releases its files.
 */
export function test_complete_snapshot_reuses_independent_host_watch_proof(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(path.dirname(fixture.file));
  const external = path.join(root, "node_modules", "external", "index.d.ts");
  fs.mkdirSync(path.dirname(external), { recursive: true });
  fs.writeFileSync(external, "export declare const value: 1;\n");
  let observations = 0;
  const filesystem = transformFilesystem(
    createTtscTransformCache({
      lstat(file) {
        if (file === external) ++observations;
        return fs.lstatSync(file, { bigint: true });
      },
      realpath(file) {
        if (file === external) ++observations;
        return fs.realpathSync.native(file);
      },
    }),
  );
  const result = {
    ...fixture.good.result,
    graph: { edges: { "src/main.ts": [external] } },
  };
  TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
  try {
    const cached = observeValidationUnitGeneration(root, result);
    assert.ok(cached.externalInputPaths?.includes(external));
    const host = (cached.hostInputMutationTracker = {
      changes: new Set<string>(),
      changesOmitted: false,
      close: () => undefined,
      contentAuthoritative: true,
      covered: new Set([external]),
      failed: false,
      membershipChanged: false,
      unverified: false,
    });
    const verify = (grouped: boolean) =>
      matchesCompleteInputSnapshot(
        cached,
        TtscGenerationProof.create(cached, fixture.file, undefined, grouped),
      );
    observations = 0;
    assert.equal(verify(true), true);
    assert.equal(observations, 0);
    assert.equal(verify(false), true);
    assert.ok(observations > 0);

    host.unverified = true;
    fs.writeFileSync(external, "export declare const value: 2;\n");
    observations = 0;
    assert.equal(verify(true), false);
    assert.ok(observations > 0);
  } finally {
    fixture.dispose();
  }
}
