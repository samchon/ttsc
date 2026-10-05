import assert from "node:assert/strict";
import { gunzipSync, gzipSync } from "node:zlib";

import { unpackNpmTarball } from "../../../../packages/playground/src/npm/internal/npmRegistry";
import { createNpmFixtureTarball } from "../internal/npmFixture";

/**
 * Verifies tar record bounds are checked before body slicing.
 *
 * Missing end markers, bodies that extend past the archive, and malformed
 * numeric fields must fail instead of producing partial maps.
 *
 * 1. Remove the end marker, overstate an entry body, and corrupt its size.
 * 2. Recompress each malformed tar through the normal gzip entry point.
 * 3. Assert record parsing fails before any partial package is published.
 *
 * @evidence contracts/testing.md#behavioral-verification unpackNpmTarball rejects missing end marker, a body size extending past the archive and nonoctal999 size before publishing partial files.
 * @evidence contracts/testing.md#independent-expectations Node gunzipSync/gzipSync independently expose and recompress fixture tar bytes; literal header offset124 and authored corrupt size strings define malformed inputs without asking the parser to manufacture expectations.
 * @evidence contracts/testing.md#distinguishing-cases End-marker truncation, valid-octal oversized body and invalid-octal numeric field exercise separate bounds; the valid baseline archive is preserved as the independently generated input.
 * @evidence contracts/testing.md#execution-ownership This source-unit entry owns all three corrupted archives and private gzip/writeSize fixture helpers, directly executing extraction in process without network or product binaries.
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
