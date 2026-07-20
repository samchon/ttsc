import {
  marketplaceProbe,
  silentLogger,
} from "../../internal/marketplace-probe";
import { assert } from "../../internal/toolchain";

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
 */
export const test_marketplace_probe_rejects_malformed_gallery_response =
  async () => {
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
