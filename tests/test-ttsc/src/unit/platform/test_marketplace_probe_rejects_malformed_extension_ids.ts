import {
  marketplaceProbe,
  silentLogger,
} from "../../internal/marketplace-probe";
import { assert } from "../../internal/script-unit";

/**
 * Verifies malformed Marketplace extension identifiers fail before querying.
 *
 * The exact-name Gallery filter accepts arbitrary strings, but a release gate
 * must not normalize whitespace, path separators, empty components, or extra
 * components into another extension identity.
 *
 * 1. Pass malformed publisher/name combinations to the bounded waiter.
 * 2. Supply a fetch implementation that records any attempted request.
 * 3. Assert every identifier fails validation without network access.
 *
 * @evidence contracts/testing.md#behavioral-verification waitForMarketplace rejects malformed identifiers with no fetch call.
 * @evidence contracts/testing.md#independent-expectations the publisher.name contract forbids empty components, whitespace, separators and extra components.
 * @evidence contracts/testing.md#distinguishing-cases eight malformed spellings contrast with the served-version unit owning the valid identity.
 * @evidence contracts/testing.md#execution-ownership The named test_marketplace_probe_rejects_malformed_extension_ids export is discovered under src/unit/platform and calls the owning authored operation without installation, native compilation or a product host.
 */
export async function test_marketplace_probe_rejects_malformed_extension_ids() {
    let attempts = 0;
    for (const extensionId of [
      "",
      ".ttsc",
      "samchon.",
      "samchon.ttsc.extra",
      "samchon/ttsc",
      " samchon.ttsc",
      "samchon.ttsc ",
      "sam_chon.ttsc",
    ])
      await assert.rejects(
        marketplaceProbe.waitForMarketplace({
          extensionId,
          timeoutMs: 1_000,
          intervalMs: 1,
          logger: silentLogger,
          fetchImpl: async () => {
            attempts += 1;
            throw new Error("fetch must not run");
          },
        }),
        /must be exactly <publisher>\.<name>/,
      );
    assert.equal(attempts, 0);
  };
