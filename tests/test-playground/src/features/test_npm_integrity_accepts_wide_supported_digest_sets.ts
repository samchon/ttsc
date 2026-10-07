import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { verifyTarball } from "../../../../packages/playground/src/npm/internal/npmRegistry";

/**
 * Verifies a legal wide integrity candidate set is authenticated without a
 * variadic expansion.
 *
 * A subresource-integrity string may list very many candidate digests.
 * Verification must accept a matching set of any width and still reject a set
 * whose digests all mismatch.
 *
 * 1. Verify tarball bytes against an integrity string repeating the matching
 *    digest once and 200000 times.
 * 2. Verify the same bytes against 200000 digests of different bytes and require
 *    the integrity mismatch error.
 *
 * @evidence contracts/testing.md#behavioral-verification verifyTarball accepts SHA-256 witnesses matching the supplied bytes for singleton and 200000-candidate sets, and rejects an equally wide mismatching set.
 * @evidence contracts/testing.md#independent-expectations node:crypto createHash independently supplies SHA-256 base64 witnesses for authored three-byte inputs; expected acceptance and mismatch follow SRI authentication semantics.
 * @evidence contracts/testing.md#distinguishing-cases Singleton and wide valid sets contrast with a wide set computed over different bytes; cancellation belongs to the archive abort-boundary unit and strongest-digest precedence to the strongest-integrity unit.
 * @evidence contracts/testing.md#execution-ownership This exported asynchronous source unit directly invokes the authored verifier and Web Crypto on an in-memory three-byte payload, without fetching or installing an archive or starting a product host.
 */
export const test_npm_integrity_accepts_wide_supported_digest_sets =
  async (): Promise<void> => {
    const bytes = new Uint8Array([1, 2, 3]);
    const good =
      "sha256-" + createHash("sha256").update(bytes).digest("base64");
    const bad =
      "sha256-" +
      createHash("sha256")
        .update(new Uint8Array([3, 2, 1]))
        .digest("base64");
    for (const size of [1, 200_000]) {
      await verifyTarball(
        bytes.buffer,
        { integrity: Array(size).fill(good).join(" ") },
        undefined,
      );
    }
    await assert.rejects(
      verifyTarball(
        bytes.buffer,
        { integrity: Array(200_000).fill(bad).join(" ") },
        undefined,
      ),
      /tarball integrity mismatch \(sha256\)/,
    );
  };
