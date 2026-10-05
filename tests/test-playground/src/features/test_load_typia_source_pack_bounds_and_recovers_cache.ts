import assert from "node:assert/strict";

import { loadTypiaSourcePack } from "../../../../packages/playground/src/compiler/loadTypiaSourcePack";

/**
 * Verifies source-pack fetch and JSON reads are caller-cancellable, retryable,
 * and single-flight while healthy.
 *
 * A response can deliver headers but leave its body pending forever. Because
 * the URL cache held that pending promise, every later worker boot inherited
 * the same dead request instead of attempting recovery. Nothing here imposes a
 * deadline — how long a network fetch takes is the network's business — so the
 * caller's `signal` is the whole recovery story and it has to actually release
 * the cache entry.
 *
 * 1. Abort a stalled JSON body, then retry that URL successfully.
 * 2. Abort two callers sharing a stalled fetch, then retry from a fresh fetch.
 * 3. Resolve two healthy callers through one fetch and one shared promise.
 *
 * @evidence contracts/testing.md#behavioral-verification loadTypiaSourcePack aborts stalled JSON/fetch, evicts failed attempts, shares a healthy load and preserves fulfilled promise/record identity only within the same URL and fetch transport.
 * @evidence contracts/testing.md#independent-expectations Independent source-text records, captured AbortSignals and fetch counters determine retries and reuse; a second transport returns distinct literal bytes for the same URL, excluding URL-only cache contamination.
 * @evidence contracts/testing.md#distinguishing-cases JSON cancellation, shared-fetch joiner cancellation, successful retry, concurrent healthy callers, fulfilled reuse and same-URL different-transport isolation each retain a concrete assertion.
 * @evidence contracts/testing.md#execution-ownership This source-unit entry owns its local injected fetch implementations, controlled response promises and every cache row; it calls loadTypiaSourcePack directly without network access, WASM boot or a Worker.
 */
export const test_load_typia_source_pack_bounds_and_recovers_cache =
  async (): Promise<void> => {
    const jsonUrl = "https://pack.invalid/source-stalled-json.json";
    let jsonCalls = 0;
    let jsonSignal: AbortSignal | undefined;
    const jsonFetch = async (
      _input: string,
      init?: RequestInit,
    ): Promise<Response> => {
      jsonSignal = init?.signal ?? undefined;
      if (jsonCalls++ === 0) {
        return {
          ok: true,
          json: () => new Promise(() => undefined),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ "typia/index.ts": "export {};" }),
      } as Response;
    };

    const stalledController = new AbortController();
    const stalled = loadTypiaSourcePack({
      url: jsonUrl,
      fetch: jsonFetch,
      signal: stalledController.signal,
    });
    stalledController.abort(new Error("reader gave up"));
    await assert.rejects(
      stalled,
      /aborted while reading JSON from .*source-stalled-json\.json/,
    );
    assert.equal(jsonSignal?.aborted, true);
    assert.deepEqual(
      await loadTypiaSourcePack({
        url: jsonUrl,
        fetch: jsonFetch,
      }),
      { "typia/index.ts": "export {};" },
    );
    assert.equal(jsonCalls, 2);

    const sharedUrl = "https://pack.invalid/source-shared-fetch.json";
    let sharedCalls = 0;
    let sharedSignal: AbortSignal | undefined;
    const sharedFetch = async (
      _input: string,
      init?: RequestInit,
    ): Promise<Response> => {
      sharedSignal = init?.signal ?? undefined;
      if (sharedCalls++ === 0) return new Promise(() => undefined);
      return {
        ok: true,
        json: async () => ({ "typia/lib/index.ts": "export {};" }),
      } as Response;
    };

    const first = loadTypiaSourcePack({
      url: sharedUrl,
      fetch: sharedFetch,
    });
    const controller = new AbortController();
    const second = loadTypiaSourcePack({
      url: sharedUrl,
      fetch: sharedFetch,
      signal: controller.signal,
    });
    assert.equal(first, second);
    const cause = new Error("worker boot cancelled");
    controller.abort(cause);
    await assert.rejects(first, (error) => {
      assert.match(
        (error as Error).message,
        /aborted while fetching .*source-shared-fetch\.json/,
      );
      assert.equal((error as Error & { cause?: unknown }).cause, cause);
      return true;
    });
    await assert.rejects(second);
    assert.equal(sharedSignal?.aborted, true);
    assert.deepEqual(
      await loadTypiaSourcePack({
        url: sharedUrl,
        fetch: sharedFetch,
      }),
      { "typia/lib/index.ts": "export {};" },
    );
    assert.equal(sharedCalls, 2);

    const healthyUrl = "https://pack.invalid/source-healthy.json";
    let healthyCalls = 0;
    let resolveHealthy!: (response: Response) => void;
    const healthyResponse = new Promise<Response>((resolve) => {
      resolveHealthy = resolve;
    });
    const healthyFetch = async (): Promise<Response> => {
      healthyCalls++;
      return healthyResponse;
    };
    const healthyFirst = loadTypiaSourcePack({
      url: healthyUrl,
      fetch: healthyFetch,
    });
    const healthySecond = loadTypiaSourcePack({
      url: healthyUrl,
      fetch: healthyFetch,
    });
    assert.equal(healthyFirst, healthySecond);
    assert.equal(healthyCalls, 1);
    resolveHealthy({
      ok: true,
      json: async () => ({ "typia/package.json": "{}" }),
    } as Response);
    assert.deepEqual(await healthyFirst, { "typia/package.json": "{}" });
    assert.deepEqual(await healthySecond, { "typia/package.json": "{}" });
    const cached = loadTypiaSourcePack({
      url: healthyUrl,
      fetch: healthyFetch,
    });
    assert.equal(
      cached,
      healthyFirst,
      "fulfilled source loads retain promise identity",
    );
    assert.equal(await cached, await healthyFirst);
    assert.equal(
      healthyCalls,
      1,
      "fulfilled source loads must not fetch again",
    );
    let independentCalls = 0;
    const independent = await loadTypiaSourcePack({
      url: healthyUrl,
      fetch: async () => {
        independentCalls++;
        return Response.json({
          "typia/package.json": '{"transport":"second"}',
        });
      },
    });
    assert.deepEqual(independent, {
      "typia/package.json": '{"transport":"second"}',
    });
    assert.equal(
      independentCalls,
      1,
      "another transport must own its own same-URL load",
    );
  };
