import assert from "node:assert/strict";
import { gunzipSync, gzipSync } from "node:zlib";

import { unpackNpmTarball } from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import { createNpmFixtureTarball } from "../internal/npmFixture";

/**
 * Verifies tar record bounds are checked before body slicing.
 *
 * Missing end markers, bodies that extend past the archive, and malformed
 * numeric fields must fail instead of producing partial maps.
 */
export const test_npm_tarball_rejects_truncated_and_overflowing_entries =
  async () => {
    const valid = new Uint8Array(gunzipSync(createNpmFixtureTarball()));
    await assert.rejects(
      unpackNpmTarball(gzip(valid.subarray(0, valid.length - 1024)), undefined),
      /no end marker/,
    );

    const oversized = valid.slice();
    writeSize(oversized, "77777777777");
    await assert.rejects(
      unpackNpmTarball(gzip(oversized), undefined),
      /extends beyond the archive/,
    );

    const malformed = valid.slice();
    writeSize(malformed, "999");
    await assert.rejects(
      unpackNpmTarball(gzip(malformed), undefined),
      /Invalid tar entry size/,
    );
  };

function gzip(bytes: Uint8Array): ArrayBuffer {
  const compressed = gzipSync(bytes);
  return compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer;
}

function writeSize(tar: Uint8Array, value: string): void {
  tar.fill(0, 124, 136);
  tar.set(new TextEncoder().encode(value), 124);
}
