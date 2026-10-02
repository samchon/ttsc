import assert from "node:assert/strict";

import { normalizeGraphInputObservation } from "../../../../../packages/unplugin/src/core/transform/envelope/normalizeGraphInputObservation";

/**
 * Verifies untrusted directory-entry proofs reject holes rather than copying
 * unobserved entries into a string-list observation.
 *
 * Go JSON arrays are dense. This directly exercises the exported untrusted
 * normalizer; it makes no claim that a native compiler emits sparse arrays.
 *
 * 1. Reject wholly sparse and partly sparse directories and files independently.
 * 2. Contrast dense strings, explicit undefined and empty lists.
 * 3. Mutate caller lists and normalized lists separately to require detached
 *    output with the originally observed literal values.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual normalizeGraphInputObservation must return undefined for non-string directory-entry slots, including sparse holes; dense and empty supported lists retain their literal content and are copied.
 * @evidence contracts/testing.md#independent-expectations The proof schema requires every slot to be a string; a hole carries no string observation. Literal undefined verdicts and literal normalized records distinguish skipped-slot validation from valid empty lists without computing expectations through Array.every or product normalization.
 * @evidence contracts/testing.md#distinguishing-cases Each of directories and files has wholly sparse, partly sparse and explicit-undefined negatives. Dense singleton lists and both-empty lists are positives; mutation in both directions verifies detached list ownership without relying on idempotency alone.
 * @evidence contracts/testing.md#execution-ownership One direct source entry invokes the exported pure normalizer with authored JavaScript values. It runs no compiler, JSON producer, filesystem, process, installed host or private generation setup; native producer transport remains outside this malformed-input oracle.
 */
export function test_graph_input_observation_rejects_sparse_entry_lists(): void {
  for (const field of ["directories", "files"] as const) {
    const partial = new Array<string>(2);
    partial[1] = "observed";
    for (const invalid of [new Array<string>(1), partial, [undefined]]) {
      const accessibleEntries = { directories: [] as unknown[], files: [] as unknown[] };
      accessibleEntries[field] = invalid;
      assert.equal(normalizeGraphInputObservation({ accessibleEntries }), undefined, `${field}: every entry must be observed string`);
    }
  }
  assert.deepEqual(normalizeGraphInputObservation({
    accessibleEntries: { directories: [], files: [] },
  }), { accessibleEntries: { directories: [], files: [] } });
  const input = { accessibleEntries: { directories: ["child"], files: ["entry.ts"] } };
  const normalized = normalizeGraphInputObservation(input);
  assert.deepEqual(normalized, { accessibleEntries: { directories: ["child"], files: ["entry.ts"] } });
  assert.ok(normalized?.accessibleEntries);
  input.accessibleEntries.directories[0] = "caller changed";
  input.accessibleEntries.files.push("caller added");
  assert.deepEqual(normalized, { accessibleEntries: { directories: ["child"], files: ["entry.ts"] } });
  normalized.accessibleEntries.directories.push("consumer added");
  normalized.accessibleEntries.files[0] = "consumer changed";
  assert.deepEqual(input, { accessibleEntries: { directories: ["caller changed"], files: ["entry.ts", "caller added"] } });
}
