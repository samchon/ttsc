import assert from "node:assert/strict";

import { loadTypiaSourcePack } from "../../../../packages/playground/lib/src/compiler/loadTypiaSourcePack.js";

/**
 * Verifies source-pack fetch and JSON reads are bounded, caller-cancellable,
 * retryable, and single-flight while healthy.
 *
 * A response can deliver headers but leave its body pending forever. Because
 * the URL cache held that pending promise, every later worker boot inherited
 * the same dead request instead of attempting recovery.
 *
 * 1. Time out a stalled JSON body, then retry that URL successfully.
 * 2. Abort two callers sharing a stalled fetch, then retry from a fresh fetch.
 * 3. Resolve two healthy callers through one fetch and one shared promise.
 */
export const test_load_typia_source_pack_bounds_and_recovers_cache =
  async (): Promise<void> => {
    assert.throws(
      () =>
        loadTypiaSourcePack({
          url: "https://pack.invalid/deadline.json",
          timeoutMs: Number.POSITIVE_INFINITY,
        }),
      /timeoutMs must be a positive integer/,
    );

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

    await assert.rejects(
      loadTypiaSourcePack({
        url: jsonUrl,
        fetch: jsonFetch,
        timeoutMs: 50,
      }),
      /timed out after 50ms while reading JSON from .*source-stalled-json\.json/,
    );
    assert.equal(jsonSignal?.aborted, true);
    assert.deepEqual(
      await loadTypiaSourcePack({
        url: jsonUrl,
        fetch: jsonFetch,
        timeoutMs: 1_000,
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
      timeoutMs: 1_000,
    });
    const controller = new AbortController();
    const second = loadTypiaSourcePack({
      url: sharedUrl,
      fetch: sharedFetch,
      signal: controller.signal,
      timeoutMs: 1_000,
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
        timeoutMs: 1_000,
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
      timeoutMs: 1_000,
    });
    const healthySecond = loadTypiaSourcePack({
      url: healthyUrl,
      fetch: healthyFetch,
      timeoutMs: 1_000,
    });
    assert.equal(healthyFirst, healthySecond);
    assert.equal(healthyCalls, 1);
    resolveHealthy({
      ok: true,
      json: async () => ({ "typia/package.json": "{}" }),
    } as Response);
    assert.deepEqual(await healthyFirst, { "typia/package.json": "{}" });
    assert.deepEqual(await healthySecond, { "typia/package.json": "{}" });
  };
