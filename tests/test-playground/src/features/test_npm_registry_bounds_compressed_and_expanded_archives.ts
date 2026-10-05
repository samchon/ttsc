import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";

import { installPlaygroundDependencies } from "../../../../packages/playground/src/npm/installPlaygroundDependencies";
import {
  downloadTarball,
  unpackNpmTarball,
} from "../../../../packages/playground/src/npm/internal/npmRegistry";
import {
  createNpmFixtureTarball,
  installNpmFixture,
} from "../internal/npmFixture";

/**
 * Verifies both network and decompression budgets are enforced by byte count.
 *
 * A missing or falsely low Content-Length cannot bypass the compressed stream
 * counter, and a small gzip cannot expand beyond the independent tar budget.
 *
 * 1. Exceed the compressed limit with absent and falsely low length headers, and
 *    verify an oversized declared response is cancelled.
 * 2. Reject invalid public limits before metadata fetch or decompressor setup.
 * 3. Keep the gzip small but set the expanded limit below its tar output.
 * 4. Assert each independent byte budget fails with its own context.
 *
 * @evidence contracts/testing.md#behavioral-verification installPlaygroundDependencies and downloadTarball enforce the compressed byte limit when Content-Length is absent or falsely low, cancel the response body on an oversized declared length and on HTTP 500, and reject limits of 0 (public options and unpackNpmTarball) before any fetch; the expanded limit is enforced through installPlaygroundDependencies, which rejects at expanded length minus one and accepts exactly the compressed and expanded lengths.
 * @evidence contracts/testing.md#independent-expectations The authored compressed length minus1 and independent Node gunzipSync expanded length minus1 pin different byte domains; literal cancellation1/fetch0 counters distinguish rejection before resource acquisition.
 * @evidence contracts/testing.md#distinguishing-cases Absent versus falsely low Content-Length, declared1000 versus limit999, HTTP500, invalid public limits and small-gzip/large-tar cases retain independent outcomes, with literal byte preservation at the exact inclusive limits.
 * @evidence contracts/testing.md#execution-ownership This entry owns every controlled response and fixture installation through injected fetch plus real in-process gzip extraction; no live registry, installed consumer or compiler host is involved.
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
    let cancelCalls = 0;
    await assert.rejects(
      downloadTarball(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              cancel() {
                ++cancelCalls;
              },
            }),
            { headers: { "content-length": "1000" } },
          ),
        "https://tar.invalid/oversized.tgz",
        undefined,
        999,
      ),
      /compressed byte limit/,
    );
    assert.equal(cancelCalls, 1, "header rejection must cancel the response");
    let httpCancelCalls = 0;
    await assert.rejects(
      downloadTarball(
        async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              cancel() {
                ++httpCancelCalls;
              },
            }),
            { status: 500 },
          ),
        "https://tar.invalid/error.tgz",
        undefined,
      ),
      /HTTP 500/,
    );
    assert.equal(httpCancelCalls, 1, "HTTP rejection must cancel the response");
    let invalidLimitFetches = 0;
    await assert.rejects(
      downloadTarball(
        async () => {
          ++invalidLimitFetches;
          return new Response(tarball);
        },
        "https://tar.invalid/invalid-limit.tgz",
        undefined,
        0,
      ),
      /positive safe integer/,
    );
    assert.equal(
      invalidLimitFetches,
      0,
      "an invalid limit must fail before opening a response",
    );
    for (const invalid of [{ maxTarballBytes: 0 }, { maxUnpackedBytes: 0 }]) {
      let installFetches = 0;
      await assert.rejects(
        installPlaygroundDependencies(["fixture"], {
          ...invalid,
          fetch: async () => {
            ++installFetches;
            throw new Error("fetch must not run");
          },
        }),
        /positive safe integer/,
      );
      assert.equal(
        installFetches,
        0,
        "public limits must be validated before metadata resolution",
      );
    }
    await assert.rejects(
      unpackNpmTarball(new Uint8Array([0, 1, 2, 3]).buffer, undefined, 0),
      /positive safe integer/,
    );

    const expandedLength = gunzipSync(new Uint8Array(tarball)).byteLength;
    const atLimit = await installNpmFixture({
      options: {
        maxTarballBytes: tarball.byteLength,
        maxUnpackedBytes: expandedLength,
      },
      tarball,
    });
    assert.equal(
      atLimit.runtimeFiles["fixture/index.js"],
      "module.exports = true;\n",
      "exact compressed/expanded limits remain inclusive",
    );
    assert.equal(
      atLimit.compilerFiles["node_modules/fixture/index.d.ts"],
      "export declare const value: true;\n",
    );
    await assert.rejects(
      installNpmFixture({
        options: { maxUnpackedBytes: expandedLength - 1 },
        tarball,
      }),
      /expanded byte limit/,
    );
  };
