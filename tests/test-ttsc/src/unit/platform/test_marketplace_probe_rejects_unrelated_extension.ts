import {
  galleryPayload,
  jsonResponse,
  marketplaceProbe,
  silentLogger,
} from "../../internal/marketplace-probe";
import { assert } from "../../internal/script-unit";

/**
 * Verifies an exact-name query cannot pass on an unrelated extension.
 *
 * The Gallery query is only a release assertion if the response publisher and
 * extension name independently match `samchon.ttsc`. Trusting the filter alone
 * could turn a server-side broad match into a false-positive publication gate.
 *
 * 1. Query `samchon.ttsc` while returning another publisher/name record.
 * 2. Give the waiter a deadline that would otherwise permit retries.
 * 3. Assert the identity mismatch fails terminally after one request.
 *
 * @evidence contracts/testing.md#behavioral-verification waitForMarketplace rejects an unrelated record after exactly one request.
 * @evidence contracts/testing.md#independent-expectations the public extension must independently match both literal publisher and name.
 * @evidence contracts/testing.md#distinguishing-cases wrong publisher and name contrast with the exact record in the served-version unit.
 * @evidence contracts/testing.md#execution-ownership The named test_marketplace_probe_rejects_unrelated_extension export is discovered under src/unit/platform and calls the owning authored operation without installation, native compilation or a product host.
 */
export async function test_marketplace_probe_rejects_unrelated_extension() {
  let attempts = 0;
  await assert.rejects(
    marketplaceProbe.waitForMarketplace({
      extensionId: "samchon.ttsc",
      timeoutMs: 1_000,
      intervalMs: 1,
      logger: silentLogger,
      fetchImpl: async () => {
        attempts += 1;
        return jsonResponse(
          galleryPayload("another-publisher", "another-name", ["0.19.4"]),
        );
      },
    }),
    /returned unrelated extension/,
  );
  assert.equal(attempts, 1);
}
