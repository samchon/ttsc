import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { markCachedSourceServed } from "../../../../../packages/unplugin/src/core/transform/validation/markCachedSourceServed";
import { matchesCachedSource } from "../../../../../packages/unplugin/src/core/transform/validation/matchesCachedSource";
import { evidencedWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/evidencedWatchInput";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies a captured generation hands off its old watch predicate while
 * sharing only first deliveries of its original pass.
 *
 * Recording newly edited disk bytes as the watch baseline would hide the edit
 * that must trigger a follow-up compilation.
 *
 * 1. Author a captured source predicate, then change the actual source file.
 * 2. Inspect the watch handoff and current-pass delivery decision.
 * 3. Refuse a repeated delivery, persistent delivery and later build pass.
 *
 * @evidence contracts/testing.md#behavioral-verification Maintained watch derivation preserves the captured hash after a real file edit; maintained source admission permits the first matching-pass delivery and refuses repeated, persistent and later-pass reuse.
 * @evidence contracts/testing.md#independent-expectations The authored source's SHA-256 determines the expected compiler predicate, while literal pass numbers and the serving checkpoint distinguish current from future requests.
 * @evidence contracts/testing.md#distinguishing-cases Captured versus edited text, first versus repeated source, declared versus persistent lifecycle and original versus later epoch pin separate authority boundaries.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin source-unit runner calls actual derivation and admission over its existing handwritten generation fixture and private filesystem files, without a compiler or host.
 */
export function test_compiler_snapshot_delivery_keeps_watch_and_pass_boundaries(): void {
  const fixture = createCachedDeliveryUnitFixture();
  try {
    const { good, file, source } = fixture;
    const hash = crypto.createHash("sha256").update(source).digest("hex");
    good.snapshotDeliveryOnly = true;
    good.passDeliveryOnly = true;
    good.projectSnapshotComplete = false;
    good.result.graph = {
      compilationSnapshot: "captured",
      edges: { "src/main.ts": [] },
      configs: [],
      globals: [],
      inputObservations: { "src/main.ts": { readFile: { ok: true, hash } } },
    };
    fs.writeFileSync(file, 'export const value = "AFTER";\n');
    const state = envelopeDerivation(good);
    const input = evidencedWatchInput(good, state, file, (value) => value);
    assert.deepEqual(input.evidence?.state, {
      codec: "predicates",
      observation: { readFile: { ok: true, hash } },
    });
    assert.equal(
      matchesCachedSource(good, file, fs.readFileSync(file, "utf8"), 1),
      true,
    );
    assert.equal(matchesCachedSource(good, file, source, undefined), false);
    assert.equal(matchesCachedSource(good, file, source, 2), false);
    markCachedSourceServed(good, file);
    assert.equal(matchesCachedSource(good, file, source, 1), false);
  } finally {
    fixture.dispose();
  }
}
