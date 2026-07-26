import assert from "node:assert/strict";

import { createTypiaSourcePackMount } from "../../../../packages/playground/lib/src/compiler/createTypiaSourcePackMount.js";
import { BASE_OPTIONS, makeFakeWorker } from "../internal/fakeWorker";

/**
 * Verifies worker boot surfaces and recovers from a source-pack timeout.
 *
 * The source-pack mount is awaited inside the cached compiler boot. A pending
 * mount therefore blocked compile, bundle, lint, and every retry behind one
 * promise even though the WASM runtime itself had booted successfully.
 *
 * 1. Stall the first source-pack fetch behind a short injected deadline.
 * 2. Assert compile returns the phase-specific cause before build can run.
 * 3. Retry compile and assert a fresh fetch mounts the pack and builds.
 */
export const test_worker_compiler_propagates_and_retries_source_pack_timeout =
  async (): Promise<void> => {
    const url = "https://pack.invalid/worker-source-pack.json";
    let fetchCalls = 0;
    const fetch = async (): Promise<Response> => {
      if (fetchCalls++ === 0) return new Promise(() => undefined);
      return {
        ok: true,
        json: async () => ({
          "typia/package.json": '{"name":"typia"}',
        }),
      } as Response;
    };
    const worker = makeFakeWorker(
      {
        ...BASE_OPTIONS,
        typiaPlugin: {
          mount: createTypiaSourcePackMount({
            url,
            fetch,
            timeoutMs: 50,
          }),
        },
        lintPlugin: false,
      },
      {},
    );

    const failed = await worker.service.compile({
      source: "export const value = 1;",
      options: { typia: false },
    });
    assert.equal(failed.type, "error");
    assert.ok(failed.value && typeof failed.value === "object");
    assert.match(
      String((failed.value as { message?: unknown }).message),
      /loadTypiaSourcePack: timed out after 50ms while fetching .*worker-source-pack\.json/,
    );
    assert.equal(worker.record.build.length, 0);
    assert.equal(worker.record.boot, 1);

    const recovered = await worker.service.compile({
      source: "export const value = 2;",
      options: { typia: false },
    });
    assert.equal(recovered.type, "success");
    assert.equal(fetchCalls, 2);
    assert.equal(worker.record.boot, 1);
    assert.equal(
      worker.record.writes["/work/node_modules/typia/package.json"],
      '{"name":"typia"}',
    );
    assert.equal(worker.record.build.length, 1);
  };
