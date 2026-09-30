import {
  marketplaceProbe,
  silentLogger,
} from "../../internal/marketplace-probe";
import { assert } from "../../internal/script-unit";

/**
 * Verifies malformed public Gallery data fails without retrying.
 *
 * A successful HTTP status is not evidence of publication when its JSON or
 * result shape cannot prove the exact extension identity and version. Retrying
 * a structurally invalid response would hide an API-contract change until the
 * deadline instead of failing the release with the actual cause.
 *
 * 1. Return HTTP 200 with invalid JSON from the injected public query.
 * 2. Run the bounded waiter with a retry-capable deadline.
 * 3. Assert it rejects as malformed after exactly one request.
 *
 * @evidence contracts/testing.md#behavioral-verification waitForMarketplace rejects invalid HTTP-200 JSON after exactly one attempt.
 * @evidence contracts/testing.md#independent-expectations successful HTTP status cannot prove an extension identity without a valid record.
 * @evidence contracts/testing.md#distinguishing-cases malformed JSON is terminal despite a retry-capable deadline; HTTP transient recovery remains in the real boundary batch.
 * @evidence contracts/testing.md#execution-ownership The named test_marketplace_probe_rejects_malformed_gallery_response export is discovered under src/unit/platform and calls the owning authored operation without installation, native compilation or a product host.
 */
export async function test_marketplace_probe_rejects_malformed_gallery_response() {
    let attempts = 0;
    await assert.rejects(
      marketplaceProbe.waitForMarketplace({
        extensionId: "samchon.ttsc",
        timeoutMs: 1_000,
        intervalMs: 1,
        logger: silentLogger,
        fetchImpl: async () => {
          attempts += 1;
          return new Response("{", { status: 200 });
        },
      }),
      /malformed JSON/,
    );
    assert.equal(attempts, 1);
  };
