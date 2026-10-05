import assert from "node:assert/strict";

import { fetchNpmMetadata } from "../../../../packages/playground/src/npm/internal/npmRegistry";

/**
 * Verifies rejected registry metadata responses release their body streams.
 *
 * Optional absence and registry errors do not consume metadata. Leaving those
 * bodies open can retain a browser connection after the dependency solve has
 * already skipped or failed the package.
 *
 * 1. Return controlled response streams for an optional 404 and a hard 500.
 * 2. Exercise the skip and rejection paths without reading either body.
 * 3. Assert both streams are cancelled exactly once.
 *
 * @evidence contracts/testing.md#behavioral-verification fetchNpmMetadata skips an optional404 as null and rejects required500 with status context, cancelling each unused response body exactly once.
 * @evidence contracts/testing.md#independent-expectations ReadableStream cancel callbacks independently count resource release; literal null/status500 and count1 derive from optional-absence versus hard-error contracts rather than helper internals.
 * @evidence contracts/testing.md#distinguishing-cases The two scenario rows differ in optionality and response status, retaining separate skip/reject assertions and stream counters without reading the rejected bodies.
 * @evidence contracts/testing.md#execution-ownership This named entry owns both injected fetch/ReadableStream scenarios and calls the actual registry metadata helper in process; no network request or dependency installation occurs.
 */
export const test_npm_registry_cancels_rejected_metadata_responses =
  async () => {
    for (const scenario of [
      { optional: true, status: 404 },
      { optional: false, status: 500 },
    ]) {
      let cancellations = 0;
      const fetchImpl = async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              ++cancellations;
            },
          }),
          { status: scenario.status },
        );

      if (scenario.optional) {
        assert.equal(
          await fetchNpmMetadata(fetchImpl, "missing-package", true, undefined),
          null,
        );
      } else {
        await assert.rejects(
          fetchNpmMetadata(fetchImpl, "broken-package", false, undefined),
          /returned 500/,
        );
      }
      assert.equal(cancellations, 1);
    }
  };
