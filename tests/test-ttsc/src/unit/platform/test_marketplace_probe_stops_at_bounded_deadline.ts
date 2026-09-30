import {
  jsonResponse,
  marketplaceProbe,
  silentLogger,
} from "../../internal/marketplace-probe";
import { assert } from "../../internal/script-unit";

/**
 * Verifies an absent public extension fails at a bounded deadline.
 *
 * Empty Gallery results can be transient during propagation and therefore merit
 * retries, but publication must never wait without a fixed upper bound. A fake
 * clock makes both the retry count and final deadline deterministic.
 *
 * 1. Return an empty valid Gallery result for every public query.
 * 2. Advance an injected clock by each requested retry delay.
 * 3. Assert failure occurs at 25 ms after four attempts and no overshoot.
 *
 * @evidence contracts/testing.md#behavioral-verification waitForMarketplace stops after four attempts exactly at 25 ms without overshoot.
 * @evidence contracts/testing.md#independent-expectations the timeout contract bounds retries by remaining time; the injected clock records requested delays.
 * @evidence contracts/testing.md#distinguishing-cases persistent empty records cross 10, 10 and 5 ms delay boundaries.
 * @evidence contracts/testing.md#execution-ownership The named test_marketplace_probe_stops_at_bounded_deadline export is discovered under src/unit/platform and calls the owning authored operation without installation, native compilation or a product host.
 */
export async function test_marketplace_probe_stops_at_bounded_deadline() {
  let now = 0;
  let attempts = 0;
  await assert.rejects(
    marketplaceProbe.waitForMarketplace({
      extensionId: "samchon.ttsc",
      timeoutMs: 25,
      intervalMs: 10,
      now: () => now,
      sleep: async (milliseconds) => {
        now += milliseconds;
      },
      logger: silentLogger,
      fetchImpl: async () => {
        attempts += 1;
        return jsonResponse({ results: [{ extensions: [] }] });
      },
    }),
    /was not publicly served within 25 ms after 4 attempt\(s\)/,
  );
  assert.equal(attempts, 4);
  assert.equal(now, 25);
}
