import assert from "node:assert/strict";

import { loadTypiaRuntimePack } from "../../../../packages/playground/lib/src/sandbox/loadTypiaRuntimePack.js";

/**
 * Verifies runtime-pack fetch and JSON reads are caller-cancellable and
 * retryable after a shared load rejects.
 *
 * Nothing imposes a deadline — how long a network fetch takes is the network's
 * business — so the caller's `signal` is the whole recovery story and it has to
 * actually release the cache entry.
 *
 * 1. Abort a stalled JSON read and require a phase-specific error.
 * 2. Retry that URL and cache the successful pack.
 * 3. Join one stalled fetch from two callers, abort the joiner, and require the
 *    shared attempt and forwarded fetch signal to cancel.
 * 4. Retry the same shared URL successfully.
 */
export const test_load_typia_runtime_pack_bounds_and_recovers_cache =
  async (): Promise<void> => {
    const originalFetch = globalThis.fetch;
    try {
      const jsonUrl = "https://pack.invalid/stalled-json.json";
      let jsonCalls = 0;
      let jsonSignal: AbortSignal | undefined;
      globalThis.fetch = (async (_input, init) => {
        jsonSignal = init?.signal ?? undefined;
        if (jsonCalls++ === 0)
          return {
            ok: true,
            json: () => new Promise(() => undefined),
          } as Response;
        return {
          ok: true,
          json: async () => ({ "typia/index.js": "module.exports = {};" }),
        } as Response;
      }) as typeof fetch;

      const stalledController = new AbortController();
      const stalled = loadTypiaRuntimePack(jsonUrl, {
        signal: stalledController.signal,
      });
      stalledController.abort(new Error("reader gave up"));
      await assert.rejects(stalled, /aborted while reading JSON/);
      assert.equal(jsonSignal?.aborted, true);
      assert.deepEqual(await loadTypiaRuntimePack(jsonUrl), {
        "typia/index.js": "module.exports = {};",
      });
      assert.equal(jsonCalls, 2);

      const sharedUrl = "https://pack.invalid/shared-fetch.json";
      let sharedCalls = 0;
      let sharedSignal: AbortSignal | undefined;
      globalThis.fetch = (async (_input, init) => {
        sharedSignal = init?.signal ?? undefined;
        if (sharedCalls++ === 0) return new Promise(() => undefined);
        return {
          ok: true,
          json: async () => ({ "typia/lib/index.js": "exports.ok = true;" }),
        } as Response;
      }) as typeof fetch;

      const first = loadTypiaRuntimePack(sharedUrl);
      const controller = new AbortController();
      const second = loadTypiaRuntimePack(sharedUrl, {
        signal: controller.signal,
      });
      assert.equal(first, second);
      const cause = new Error("new Execute started");
      controller.abort(cause);
      await assert.rejects(first, (error) => {
        assert.match(
          (error as Error).message,
          /aborted while fetching .*shared-fetch\.json/,
        );
        assert.equal((error as Error & { cause?: unknown }).cause, cause);
        return true;
      });
      await assert.rejects(second);
      assert.equal(sharedSignal?.aborted, true);

      assert.deepEqual(await loadTypiaRuntimePack(sharedUrl), {
        "typia/lib/index.js": "exports.ok = true;",
      });
      assert.equal(sharedCalls, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  };
