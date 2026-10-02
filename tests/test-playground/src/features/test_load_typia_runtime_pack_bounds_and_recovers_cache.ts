import assert from "node:assert/strict";

import { loadTypiaRuntimePack } from "../../../../packages/playground/src/sandbox/loadTypiaRuntimePack";

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
 * 4. Retry the shared URL, share a healthy pending and fulfilled load, and retry
 *    HTTP, malformed, fetch and JSON failures without retaining rejected entries.
 *
 * @evidence contracts/testing.md#behavioral-verification loadTypiaRuntimePack aborts stalled JSON/fetch, forwards cancellation, evicts failures and shares healthy pending and fulfilled promise/record identity. Repeated calls at the failed URL recover actual authored module-text records.
 * @evidence contracts/testing.md#independent-expectations Controlled fetch counters and authored module-text records fix retry2 and healthy cache reuse. Exact phase diagnostics and cause identity distinguish cancellation; HTTP404, array, nonstring record and authored fetch/JSON errors independently distinguish rejected attempts.
 * @evidence contracts/testing.md#distinguishing-cases Stalled JSON/shared fetch abort and retry contrast with healthy pending/fulfilled sharing. HTTP404, array, nonstring record, fetch rejection and JSON rejection each evict before a successful retry.
 * @evidence contracts/testing.md#execution-ownership This exported source unit calls the authored runtime loader with a case-local replacement fetch and restores global fetch in finally. It owns all five URL scenarios, gates and cache assertions; responses are doubles and no network or host runs.
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
      const recovered = loadTypiaRuntimePack(jsonUrl);
      const recoveredAgain = loadTypiaRuntimePack(jsonUrl);
      assert.equal(recoveredAgain, recovered);
      assert.equal(await recoveredAgain, await recovered);
      assert.equal(jsonCalls, 2, "fulfilled runtime packs must not fetch again");

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

      const healthyUrl = "https://pack.invalid/runtime-healthy.json";
      let healthyCalls = 0;
      let resolveHealthy!: (response: Response) => void;
      const healthyResponse = new Promise<Response>((resolve) => {
        resolveHealthy = resolve;
      });
      globalThis.fetch = (async () => {
        healthyCalls++;
        return healthyResponse;
      }) as typeof fetch;
      const healthy = loadTypiaRuntimePack(healthyUrl);
      const joined = loadTypiaRuntimePack(healthyUrl);
      assert.strictEqual(joined, healthy);
      assert.equal(healthyCalls, 1);
      resolveHealthy(Response.json({ "typia/index.js": "HEALTHY" }));
      assert.deepEqual(await healthy, { "typia/index.js": "HEALTHY" });
      assert.strictEqual(await joined, await healthy);
      assert.strictEqual(loadTypiaRuntimePack(healthyUrl), healthy);
      assert.equal(healthyCalls, 1);

      const malformedUrl = "https://pack.invalid/runtime-malformed.json";
      const malformedResponses = [
        new Response(null, { status: 404 }),
        Response.json(["not", "a", "record"]),
        Response.json({ "typia/index.js": 1 }),
        Response.json({ "typia/index.js": "RECOVERED" }),
      ];
      let malformedCalls = 0;
      globalThis.fetch = (async () => malformedResponses[malformedCalls++]!) as typeof fetch;
      await assert.rejects(loadTypiaRuntimePack(malformedUrl), /failed to fetch .*: 404/);
      await assert.rejects(loadTypiaRuntimePack(malformedUrl), /expected a source-text record map/);
      await assert.rejects(loadTypiaRuntimePack(malformedUrl), /expected a source-text record map/);
      assert.deepEqual(await loadTypiaRuntimePack(malformedUrl), { "typia/index.js": "RECOVERED" });
      assert.equal(malformedCalls, 4);

      const rejectedUrl = "https://pack.invalid/runtime-rejected.json";
      const fetchError = new Error("authored fetch rejection");
      const jsonError = new Error("authored JSON rejection");
      let rejectedCalls = 0;
      globalThis.fetch = (async () => {
        if (++rejectedCalls === 1) throw fetchError;
        if (rejectedCalls === 2)
          return { ok: true, json: async () => { throw jsonError; } } as unknown as Response;
        return Response.json({ "typia/index.js": "RETRIED" });
      }) as typeof fetch;
      await assert.rejects(loadTypiaRuntimePack(rejectedUrl), (error) => error === fetchError);
      await assert.rejects(loadTypiaRuntimePack(rejectedUrl), (error) => error === jsonError);
      assert.deepEqual(await loadTypiaRuntimePack(rejectedUrl), { "typia/index.js": "RETRIED" });
      assert.equal(rejectedCalls, 3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  };
