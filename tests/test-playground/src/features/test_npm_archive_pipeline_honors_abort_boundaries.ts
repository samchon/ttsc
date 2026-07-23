import assert from "node:assert/strict";

import {
  downloadTarball,
  fetchNpmMetadata,
  unpackNpmTarball,
  verifyTarball,
} from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import { createNpmFixtureTarball } from "../internal/npmFixture";

function createStartSignal(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Verifies cancellation is observed across the archive handoff.
 *
 * Superseded per-keystroke installs have no reusable result, so waiting for
 * another network chunk or digest only consumes browser-tab resources.
 *
 * 1. Abort after stalled metadata fetch, JSON, and tarball fetch work starts.
 * 2. Abort active streamed and bodyless reads and dispose a late response.
 * 3. Abort at the response handoff and retain the exact reason while disposing
 *    metadata and tarball bodies.
 * 4. Prioritize synchronous aborts and remove listeners from stalled work.
 * 5. Abort an in-flight digest, then pass an already aborted signal through
 *    download, verification, and decompression and assert every stage stops.
 */
export const test_npm_archive_pipeline_honors_abort_boundaries = async () => {
  const tarball = createNpmFixtureTarball();
  const reason = new DOMException("fixture aborted", "AbortError");
  const rejectsAbort = (task: Promise<unknown>) =>
    assert.rejects(task, (error) => error === reason);

  const metadataFetchController = new AbortController();
  const metadataFetchStarted = createStartSignal();
  const metadataFetch = fetchNpmMetadata(
    () => {
      metadataFetchStarted.resolve();
      return new Promise<Response>(() => undefined);
    },
    "fixture",
    false,
    metadataFetchController.signal,
  );
  await metadataFetchStarted.promise;
  metadataFetchController.abort(reason);
  await rejectsAbort(metadataFetch);

  const metadataJsonController = new AbortController();
  const metadataJsonStarted = createStartSignal();
  const metadataJson = fetchNpmMetadata(
    async () =>
      ({
        body: null,
        json: () => {
          metadataJsonStarted.resolve();
          return new Promise<unknown>(() => undefined);
        },
        ok: true,
        status: 200,
      }) as Response,
    "fixture",
    false,
    metadataJsonController.signal,
  );
  await metadataJsonStarted.promise;
  metadataJsonController.abort(reason);
  await rejectsAbort(metadataJson);

  const tarballFetchController = new AbortController();
  const tarballFetchStarted = createStartSignal();
  const tarballFetch = downloadTarball(
    () => {
      tarballFetchStarted.resolve();
      return new Promise<Response>(() => undefined);
    },
    "https://tar.invalid/fetch.tgz",
    tarballFetchController.signal,
  );
  await tarballFetchStarted.promise;
  tarballFetchController.abort(reason);
  await rejectsAbort(tarballFetch);

  const downloadController = new AbortController();
  const streamReadStarted = createStartSignal();
  let streamCancelCalls = 0;
  const downloading = downloadTarball(
    async () =>
      ({
        arrayBuffer: () => new Promise<ArrayBuffer>(() => undefined),
        body: {
          getReader: () => {
            streamReadStarted.resolve();
            return {
              cancel: async () => {
                ++streamCancelCalls;
              },
              read: () =>
                new Promise<ReadableStreamReadResult<Uint8Array>>(
                  () => undefined,
                ),
            };
          },
        },
        headers: new Headers(),
        ok: true,
        status: 200,
      }) as Response,
    "https://tar.invalid/fixture.tgz",
    downloadController.signal,
  );
  await streamReadStarted.promise;
  downloadController.abort(reason);
  await rejectsAbort(downloading);
  assert.ok(streamCancelCalls >= 1);

  const bodylessController = new AbortController();
  const bodylessReadStarted = createStartSignal();
  const bodylessDownload = downloadTarball(
    async () =>
      ({
        arrayBuffer: () => {
          bodylessReadStarted.resolve();
          return new Promise<ArrayBuffer>(() => undefined);
        },
        body: null,
        headers: new Headers(),
        ok: true,
        status: 200,
      }) as Response,
    "https://tar.invalid/bodyless.tgz",
    bodylessController.signal,
  );
  await bodylessReadStarted.promise;
  bodylessController.abort(reason);
  await rejectsAbort(bodylessDownload);

  const lateResponseController = new AbortController();
  let resolveLateResponse!: (response: Response) => void;
  const lateResponsePromise = new Promise<Response>((resolve) => {
    resolveLateResponse = resolve;
  });
  let lateResponseCancelCalls = 0;
  const lateResponseDownload = downloadTarball(
    () => lateResponsePromise,
    "https://tar.invalid/late-response.tgz",
    lateResponseController.signal,
  );
  lateResponseController.abort(reason);
  await rejectsAbort(lateResponseDownload);
  resolveLateResponse({
    body: {
      cancel: async () => {
        ++lateResponseCancelCalls;
      },
    },
  } as Response);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(lateResponseCancelCalls, 1);

  const metadataHandoffController = new AbortController();
  let resolveMetadataHandoff!: (response: Response) => void;
  const metadataHandoffPromise = new Promise<Response>((resolve) => {
    resolveMetadataHandoff = resolve;
  });
  let metadataHandoffCancelCalls = 0;
  const metadataAtHandoff = fetchNpmMetadata(
    () => metadataHandoffPromise,
    "optional-fixture",
    true,
    metadataHandoffController.signal,
  );
  void metadataHandoffPromise.then(() => {
    queueMicrotask(() => metadataHandoffController.abort(reason));
  });
  resolveMetadataHandoff({
    body: {
      cancel: async () => {
        ++metadataHandoffCancelCalls;
      },
    },
    ok: false,
    status: 404,
  } as Response);
  await rejectsAbort(metadataAtHandoff);
  assert.equal(metadataHandoffCancelCalls, 1);

  const tarballHandoffController = new AbortController();
  let resolveTarballHandoff!: (response: Response) => void;
  const tarballHandoffPromise = new Promise<Response>((resolve) => {
    resolveTarballHandoff = resolve;
  });
  let tarballHandoffCancelCalls = 0;
  const tarballAtHandoff = downloadTarball(
    () => tarballHandoffPromise,
    "https://tar.invalid/response-handoff.tgz",
    tarballHandoffController.signal,
  );
  void tarballHandoffPromise.then(() => {
    queueMicrotask(() => tarballHandoffController.abort(reason));
  });
  resolveTarballHandoff({
    body: {
      cancel: async () => {
        ++tarballHandoffCancelCalls;
      },
    },
    ok: false,
    status: 503,
  } as Response);
  await rejectsAbort(tarballAtHandoff);
  assert.equal(tarballHandoffCancelCalls, 1);

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
  await rejectsAbort(abortedDuringFetch);
  assert.equal(fallbackCallsAfterFetchAbort, 0);

  const rejectedFetchController = new AbortController();
  let rejectFetch!: (error: Error) => void;
  const rejectedAfterAbort = downloadTarball(
    () => {
      rejectedFetchController.abort(reason);
      return new Promise<Response>((_resolve, reject) => {
        rejectFetch = reject;
      });
    },
    "https://tar.invalid/rejected-after-abort.tgz",
    rejectedFetchController.signal,
  );
  await rejectsAbort(rejectedAfterAbort);
  rejectFetch(new Error("late fetch failure"));
  await new Promise<void>((resolve) => setImmediate(resolve));

  const throwingFetchController = new AbortController();
  const synchronousThrowAfterAbort = downloadTarball(
    () => {
      throwingFetchController.abort(reason);
      throw new Error("synchronous fetch failure");
    },
    "https://tar.invalid/synchronous-throw.tgz",
    throwingFetchController.signal,
  );
  await rejectsAbort(synchronousThrowAfterAbort);

  let stalledSignalAborted = false;
  const stalledSignalListeners = new Set<unknown>();
  const stalledSignal = {
    addEventListener: (_type: string, listener: unknown) => {
      stalledSignalListeners.add(listener);
    },
    get aborted() {
      return stalledSignalAborted;
    },
    get reason() {
      return reason;
    },
    removeEventListener: (_type: string, listener: unknown) => {
      stalledSignalListeners.delete(listener);
    },
  } as unknown as AbortSignal;
  const stalledAfterSynchronousAbort = downloadTarball(
    () => {
      stalledSignalAborted = true;
      return new Promise<Response>(() => undefined);
    },
    "https://tar.invalid/stalled-after-synchronous-abort.tgz",
    stalledSignal,
  );
  await rejectsAbort(stalledAfterSynchronousAbort);
  assert.equal(stalledSignalListeners.size, 0);

  const digestController = new AbortController();
  const digesting = verifyTarball(
    new ArrayBuffer(16 * 1024 * 1024),
    {
      integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
    },
    digestController.signal,
  );
  digestController.abort(reason);
  await rejectsAbort(digesting);

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
