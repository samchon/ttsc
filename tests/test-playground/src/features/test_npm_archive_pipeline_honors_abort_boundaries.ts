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
 * 1. Abort while a streamed download produces its first chunk and assert the byte
 *    collector stops.
 * 2. Pass an already aborted signal to verification and decompression and assert
 *    neither stage continues.
 */
export const test_npm_archive_pipeline_honors_abort_boundaries = async () => {
  const tarball = createNpmFixtureTarball();
  const downloadController = new AbortController();
  const reason = new DOMException("fixture aborted", "AbortError");
  await assert.rejects(
    downloadTarball(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.enqueue(new Uint8Array(tarball.slice(0, 8)));
              downloadController.abort(reason);
            },
          }),
        ),
      "https://tar.invalid/fixture.tgz",
      downloadController.signal,
    ),
    { name: "AbortError" },
  );

  const stopped = new AbortController();
  stopped.abort(reason);
  await assert.rejects(verifyTarball(tarball, {}, stopped.signal), {
    name: "AbortError",
  });
  await assert.rejects(unpackNpmTarball(tarball, stopped.signal), {
    name: "AbortError",
  });
};
