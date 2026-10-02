import assert from "node:assert/strict";
import { createHash } from "node:crypto";

/**
 * Verifies the canonical digest serializes parsed declarations independently of
 * how they were written, while keeping everything a reviewer could see change.
 *
 * Swagger and Prisma review fingerprints are hashes of parsed values. Object key
 * order is an artifact of the input dialect, so it must not reach the hash;
 * array order and values are content, so they must.
 *
 * 1. Digest literal values whose canonical JSON text is written out by hand.
 * 2. Reorder object keys and array elements and compare the digests.
 * 3. Digest undefined members, a cyclic object and `withoutKeys` removal.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored canonicalDigest, canonicalJson and withoutKeys on literal values. A serializer that keeps insertion order, sorts arrays, folds distinct values together or mutates its input fails one of the assertions.
 * @evidence contracts/testing.md#independent-expectations The expected digest is SHA-256 over a canonical JSON string written by hand from the sorted-key, no-whitespace rule, not produced by the implementation; relational expectations follow from what a declaration digest must ignore or retain.
 * @evidence contracts/testing.md#distinguishing-cases Reordered keys at two depths must match; reordered array elements, a changed or retyped scalar and an empty array against an empty object must differ from the original. An undefined member must equal an absent one, and a cyclic value must terminate with the marker the source documents, which aliases an authored "[circular]" string as a stated limitation, while a repeated sibling object is not a cycle. Removal drops only the named keys and leaves its input intact.
 * @evidence contracts/testing.md#execution-ownership The matching src/features export is discovered by test-evidence's runner and central function claim. It imports the pure maintained source operations and executes them in the same Node process with no filesystem, compiler or product process.
 */
export async function test_evidence_canonical_digest_ignores_key_order_and_keeps_array_order(): Promise<void> {
  const { canonicalDigest, canonicalJson, withoutKeys } = (await import(
    new URL(
      "../../../../packages/evidence/src/internal/canonicalDigest.ts",
      import.meta.url,
    ).href
  )) as {
    canonicalDigest(value: unknown): string;
    canonicalJson(value: unknown): string;
    withoutKeys<Value>(value: Value, ...keys: string[]): Value;
  };
  const sha256 = (text: string): string =>
    createHash("sha256").update(text).digest("hex");

  const failures: unknown[] = [];
  const check = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  check("sorted-key canonical text", () => {
    const value = { b: 1, a: [2, 1], c: { z: null, y: "x" } };
    assert.equal(
      canonicalJson(value),
      '{"a":[2,1],"b":1,"c":{"y":"x","z":null}}',
    );
    assert.equal(
      canonicalDigest(value),
      sha256('{"a":[2,1],"b":1,"c":{"y":"x","z":null}}'),
    );
  });
  check("key order is not content", () => {
    assert.equal(
      canonicalDigest({ a: 1, b: { c: 2, d: 3 } }),
      canonicalDigest({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });
  check("array order and scalar values are content", () => {
    const original = canonicalDigest({ required: ["id", "name"] });
    assert.notEqual(original, canonicalDigest({ required: ["name", "id"] }));
    assert.notEqual(original, canonicalDigest({ required: ["id", "title"] }));
    assert.notEqual(canonicalDigest({ a: 1 }), canonicalDigest({ a: "1" }));
    assert.notEqual(canonicalDigest({ a: [] }), canonicalDigest({ a: {} }));
  });
  check("undefined members", () => {
    assert.equal(canonicalDigest({ a: 1, b: undefined }), canonicalDigest({ a: 1 }));
    assert.equal(canonicalJson([1, undefined, 3]), "[1,null,3]");
  });
  check("cyclic value terminates", () => {
    const cycle: Record<string, unknown> = { name: "node" };
    cycle.self = cycle;
    assert.equal(canonicalJson(cycle), '{"name":"node","self":"[circular]"}');
    // The marker is documented as an authored literal string's alias.
    assert.equal(
      canonicalDigest({ name: "node", self: "[circular]" }),
      canonicalDigest(cycle),
    );
    // Siblings that merely repeat one object are not a cycle.
    const shared = { k: 1 };
    assert.equal(
      canonicalJson({ left: shared, right: shared }),
      '{"left":{"k":1},"right":{"k":1}}',
    );
  });
  check("withoutKeys removes only the named keys", () => {
    const original = { documentation: "doc", fields: [1], name: "Sale" };
    const reduced = withoutKeys(original, "documentation", "fields");
    assert.deepEqual(reduced, { name: "Sale" });
    assert.deepEqual(original, {
      documentation: "doc",
      fields: [1],
      name: "Sale",
    });
    assert.equal(
      canonicalDigest(withoutKeys({ ...original, documentation: "other" }, "documentation", "fields")),
      canonicalDigest(reduced),
    );
  });

  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Canonical digest cases failed.");
}
