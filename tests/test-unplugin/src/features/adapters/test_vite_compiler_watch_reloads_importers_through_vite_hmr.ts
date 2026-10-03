import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureWatchInputBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/captureWatchInputBaseline";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

/**
 * Verifies a compiler-input change updates its importers through Vite's own
 * module reload in every environment, and reloads the page only where Vite
 * cannot (samchon/ttsc#1393).
 *
 * Editing an interface a typia validator is generated from used to send a full
 * reload, so every client lost its state even inside an HMR boundary. Each
 * environment's `reloadModule` now receives the importer's modules, which is
 * what an edit to the importer itself triggers. A server with `hmr: false`
 * keeps the invalidate-and-reload fallback.
 *
 * 1. Attach a server with client and SSR environments that record reloads and
 *    reload messages, register an importer's input, and change it.
 * 2. Assert both environments reloaded the importer and no full reload was sent.
 * 3. Repeat with `hmr: false` and assert the importer is invalidated and the page
 *    reloaded.
 * @evidence contracts/testing.md#behavioral-verification
 *   Injects declaration changes into authored watcher logic and asserts enabled HMR reloads client/SSR without adapter messages, while disabled HMR invalidates both and sends full-reload.
 * @evidence contracts/testing.md#independent-expectations
 *   Vite owns HMR decisions when reloadModule is available; disabled HMR requires graph invalidation plus full-reload. Literal client/ssr names distinguish both attached environments.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Compares HMR enabled and disabled with the same changed dependency; captures reloads, invalidations and messages independently so a wrong fallback cannot pass.
 * @evidence contracts/testing.md#execution-ownership
 *   test_vite_compiler_watch_reloads_importers_through_vite_hmr owns run(true) and run(false), which call createViteServeInputWatch.attach/replace and inject dependency events into client/SSR doubles; both watchers dispose in finally without a Vite process.
 */
export async function test_vite_compiler_watch_reloads_importers_through_vite_hmr(): Promise<void> {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-vite-hmr-"));
  const input = path.join(root, "shape.d.ts");
  const importer = path.join(root, "main.ts").replace(/\\/g, "/");

  const run = async (hmr: boolean) => {
    fs.writeFileSync(input, "export interface Shape { a: 1 }\n");
    const baseline = captureWatchInputBaseline(input);
    assert.ok(baseline);
    const reloaded: string[] = [];
    const invalidated: string[] = [];
    const messages: string[] = [];
    let emit: ((eventType: string, file: string | null) => void) | undefined;
    const environment = (name: string) => ({
      hot: { send: (payload: { type: string }) => messages.push(payload.type) },
      moduleGraph: {
        getModulesByFile: (file: string) =>
          file === importer ? new Set([{ file, name }]) : undefined,
        invalidateModule: (node: object) =>
          invalidated.push((node as { name: string }).name),
      },
      reloadModule: async (node: object) => {
        reloaded.push((node as { name: string }).name);
      },
    });
    const watch = createViteServeInputWatch({
      poll: () => ({ close: () => undefined }),
      watch: (_scope, listener) => {
        emit = listener;
        return { close: () => undefined };
      },
    });
    watch.attach({
      config: { root, server: { hmr: hmr ? {} : false } },
      environments: { client: environment("client"), ssr: environment("ssr") },
    });
    try {
      watch.replace(importer, [
        {
          evidence: {
            identity: baseline.identity,
            missing: false,
            state: { codec: "host", hash: baseline.hostHash },
          },
          file: input,
        },
      ]);
      fs.writeFileSync(input, "export interface Shape { a: 2 }\n");
      emit?.("change", input);
      await waitFor(
        () => reloaded.length + invalidated.length !== 0,
        "the importer to be updated",
      );
      return { invalidated, messages, reloaded };
    } finally {
      await watch.dispose();
    }
  };

  const hot = await run(true);
  assert.deepEqual(hot.reloaded.sort(), ["client", "ssr"]);
  assert.deepEqual(hot.invalidated, [], "successful HMR must not take the adapter's fallback");
  assert.deepEqual(hot.messages, [], "Vite, not the adapter, decides a reload");

  const cold = await run(false);
  assert.deepEqual(cold.reloaded, []);
  assert.deepEqual(cold.invalidated.sort(), ["client", "ssr"]);
  assert.ok(cold.messages.includes("full-reload"));
}
