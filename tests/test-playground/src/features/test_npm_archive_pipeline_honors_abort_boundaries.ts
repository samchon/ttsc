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
 * 1. Abort while a streamed download is waiting and assert the byte collector
 *    rejects without waiting for another chunk.
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
