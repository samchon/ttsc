import assert from "node:assert/strict";

import { fetchNpmMetadata } from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";

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
