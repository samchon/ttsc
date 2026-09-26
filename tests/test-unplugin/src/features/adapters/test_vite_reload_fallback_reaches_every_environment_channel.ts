import assert from "node:assert/strict";

import { reloadImporters } from "../../../../../packages/unplugin/lib/core/vite/reloadImporters.js";

/**
 * Verifies the Vite reload fallback reaches every environment's own channel,
 * once each.
 *
 * When an environment's `reloadModule` fails, the adapter invalidates the
 * importers and sends a full reload. It sent through the first of `ws`, `hot`,
 * and the client environment's `hot` that accepted the payload, so a custom
 * environment with its own transport never heard it and kept running stale
 * modules. Vite sends a full reload to each environment; the server-level
 * `ws` and `hot` are aliases of the client environment's channel there, while a
 * Vite 5 server has one mixed graph and one channel.
 *
 * 1. Attach a Vite 6-shaped server whose client channel is also `ws` and `hot`,
 *    and whose `edge` environment has its own channel and a failing reload.
 * 2. Reload an importer and wait for the fallback.
 * 3. Assert each environment channel received one full reload, the client one
 *    exactly once, and a Vite 5 server still receives one through `ws`.
 */
export async function test_vite_reload_fallback_reaches_every_environment_channel(): Promise<void> {
  const importer = "/project/src/main.ts";
  const sends: string[] = [];
  const channel = (name: string) => ({
    send: (payload: { type: string }) => sends.push(`${name}:${payload.type}`),
  });
  const graph = {
    getModulesByFile: (file: string) =>
      file === importer ? new Set([{ file }]) : undefined,
    invalidateModule: () => undefined,
  };
  const client = channel("client");
  reloadImporters(
    {
      environments: {
        client: { hot: client, moduleGraph: graph, reloadModule: async () => {} },
        edge: {
          hot: channel("edge"),
          moduleGraph: graph,
          reloadModule: async () => {
            throw new Error("edge runner cannot hot-update");
          },
        },
        worker: {
          hot: channel("worker"),
          moduleGraph: graph,
          reloadModule: async () => {},
        },
      },
      hot: client,
      ws: client,
    },
    new Set([importer]),
  );
  await waitFor(() => sends.length >= 3);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(sends.sort(), [
    "client:full-reload",
    "edge:full-reload",
    "worker:full-reload",
  ]);

  sends.length = 0;
  reloadImporters(
    {
      config: { server: { hmr: false } },
      hot: channel("hot"),
      moduleGraph: graph,
      ws: channel("ws"),
    },
    new Set([importer]),
  );
  assert.deepEqual(sends, ["ws:full-reload"]);
}

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!condition()) {
    if (Date.now() > deadline) assert.fail("the fallback never ran");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
