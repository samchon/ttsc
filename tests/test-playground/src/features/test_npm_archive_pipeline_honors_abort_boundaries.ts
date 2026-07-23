import assert from "node:assert/strict";

import {
  downloadTarball,
  unpackNpmTarball,
  verifyTarball,
} from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import { createNpmFixtureTarball } from "../internal/npmFixture";

/**
 * Verifies cancellation is observed across the archive handoff.
 *
 * Superseded per-keystroke installs have no reusable result, so waiting for
 * another network chunk or digest only consumes browser-tab resources.
 *
 * 1. Abort while streamed and bodyless downloads are waiting and assert both byte
 *    collectors reject without waiting for their underlying operations.
 * 2. Abort an in-flight digest, then pass an already aborted signal through
 *    download, verification, and decompression and assert every stage stops.
 */
export const test_npm_archive_pipeline_honors_abort_boundaries = async () => {
  const tarball = createNpmFixtureTarball();
  const downloadController = new AbortController();
  const reason = new DOMException("fixture aborted", "AbortError");
  const downloading = downloadTarball(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull: () => new Promise<void>(() => undefined),
        }),
      ),
    "https://tar.invalid/fixture.tgz",
    downloadController.signal,
  );
  await Promise.resolve();
  downloadController.abort(reason);
  await assert.rejects(downloading, { name: "AbortError" });

  const bodylessController = new AbortController();
  const bodylessDownload = downloadTarball(
    async () =>
      ({
        arrayBuffer: () => new Promise<ArrayBuffer>(() => undefined),
        body: null,
        headers: new Headers(),
        ok: true,
        status: 200,
      }) as Response,
    "https://tar.invalid/bodyless.tgz",
    bodylessController.signal,
  );
  await Promise.resolve();
  bodylessController.abort(reason);
  await assert.rejects(bodylessDownload, { name: "AbortError" });

  const fetchController = new AbortController();
  let fallbackCallsAfterFetchAbort = 0;
  const abortedDuringFetch = downloadTarball(
    async () => {
      fetchController.abort(reason);
      return {
        arrayBuffer: async () => {
          ++fallbackCallsAfterFetchAbort;
          return new ArrayBuffer(0);
        },
        body: null,
        headers: new Headers(),
        ok: true,
        status: 200,
      } as Response;
    },
    "https://tar.invalid/aborted-during-fetch.tgz",
    fetchController.signal,
  );
  await assert.rejects(abortedDuringFetch, { name: "AbortError" });
  assert.equal(fallbackCallsAfterFetchAbort, 0);

  const digestController = new AbortController();
  const digesting = verifyTarball(
    new ArrayBuffer(16 * 1024 * 1024),
    {
      integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
    },
    digestController.signal,
  );
  digestController.abort(reason);
  await assert.rejects(digesting, { name: "AbortError" });

  const stopped = new AbortController();
  stopped.abort(reason);
  await assert.rejects(verifyTarball(tarball, {}, stopped.signal), {
    name: "AbortError",
  });
  let stoppedFetches = 0;
  await assert.rejects(
    downloadTarball(
      async () => {
        ++stoppedFetches;
        return new Response(tarball);
      },
      "https://tar.invalid/stopped.tgz",
      stopped.signal,
      0,
    ),
    { name: "AbortError" },
  );
  assert.equal(stoppedFetches, 0);
  await assert.rejects(unpackNpmTarball(tarball, stopped.signal), {
    name: "AbortError",
  });
};
