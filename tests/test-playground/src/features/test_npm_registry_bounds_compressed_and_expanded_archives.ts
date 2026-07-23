import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";

import {
  createNpmFixtureTarball,
  installNpmFixture,
} from "../internal/npmFixture";

/**
 * Verifies both network and decompression budgets are enforced by byte count.
 *
 * A missing or falsely low Content-Length cannot bypass the compressed stream
 * counter, and a small gzip cannot expand beyond the independent tar budget.
 */
export const test_npm_registry_bounds_compressed_and_expanded_archives =
  async () => {
    const tarball = createNpmFixtureTarball();
    const compressedLimit = tarball.byteLength - 1;
    await assert.rejects(
      installNpmFixture({
        options: { maxTarballBytes: compressedLimit },
        tarball,
      }),
      /compressed byte limit/,
    );
    await assert.rejects(
      installNpmFixture({
        options: { maxTarballBytes: compressedLimit },
        responseHeaders: { "content-length": "1" },
        tarball,
      }),
      /compressed byte limit/,
    );

    const expandedLength = gunzipSync(new Uint8Array(tarball)).byteLength;
    await assert.rejects(
      installNpmFixture({
        options: { maxUnpackedBytes: expandedLength - 1 },
        tarball,
      }),
      /expanded byte limit/,
    );
  };
