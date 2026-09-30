import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { BunLoadOptions } from "../../internal/adapter-bun/BunLoadOptions";
import type { BunLoader } from "../../internal/adapter-bun/BunLoader";

/**
 * Verifies Bun bundler hooks bracket the shared transform build lifecycle.
 *
 * The first compile emits a second module but only serves `main.ts`. After
 * corrupting `main.ts`, the unchanged second module would still be a valid
 * first-use cache hit unless `onStart` opened a new delivery pass: the pass's
 * first delivery re-proves the whole generation, sees the changed input, and
 * compiles again. The completed build then closes its generation, so another
 * unchanged build must compile once more instead of retaining the old
 * generation and its filesystem trackers past `onEnd`.
 *
 * 1. Capture the adapter's `onStart`, `onEnd`, and loader, and deliver `main.ts`
 *    in a first build.
 * 2. Corrupt `main.ts`, start a new build, and assert delivering the second module
 *    compiles again.
 * 3. End the build and assert an unchanged next build compiles once more.
 *
 * @evidence contracts/testing.md#behavioral-verification Captured onStart/onEnd retain an unchanged generation, reject a broken main when secondary is delivered, recover at count two, and compile at count three after end.
 * @evidence contracts/testing.md#independent-expectations Fixture count-runs appends one byte per compile; the broken main independently lacks the required value export.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged pass, changed input on first secondary delivery, compile failure, recovery, and completed-build disposal.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_bun_adapter_forwards_bundler_build_start is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built Bun hooks connect lifecycle to native compiler; host scheduling is simulated.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: captured onStart/onEnd retain an unchanged generation, reject a broken main when secondary is delivered, recover at count two, and compile at count three after end. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_bun_adapter_forwards_bundler_build_start(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-bun-build-log-"),
    "compiles.bin",
  );
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/secondary.ts",
      },
      {
        transform: "./plugin.cjs",
        name: "runs",
        operation: "count-runs",
        runLog,
      },
    ],
  });
  const secondary = path.join(root, "src", "secondary.ts");
  fs.writeFileSync(secondary, "export const secondary = 1;\n", "utf8");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);

  let start: (() => void | Promise<void>) | undefined;
  let end: (() => void | Promise<void>) | undefined;
  const loaders: BunLoader[] = [];
  unpluginBun().setup({
    onStart(callback: () => void | Promise<void>) {
      start = callback;
    },
    onEnd(callback: () => void | Promise<void>) {
      end = callback;
    },
    onLoad(_options: BunLoadOptions, loader: BunLoader) {
      loaders.push(loader);
    },
  });
  assert.ok(start, "Bun bundler setup must register onStart when available");
  assert.ok(end, "Bun bundler setup must register onEnd when available");
  const loader = loaders[0];
  assert.ok(loader);

  const first = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(first);
  TestUnpluginProject.assertTransformedToPlugin(first.contents);
  assert.equal(compiles(), 1);

  await start();
  const unchanged = await loader({ path: TestUnpluginProject.mainFile(root) });
  assert.ok(unchanged);
  assert.equal(
    compiles(),
    1,
    "a new build pass must retain an unchanged active generation",
  );

  fs.writeFileSync(
    TestUnpluginProject.mainFile(root),
    "export const broken = true;\n",
    "utf8",
  );
  await start();
  await assert.rejects(
    () => loader({ path: secondary }),
    /expected export const value/,
    "the next build must compile again instead of serving the old generation",
  );

  fs.writeFileSync(
    TestUnpluginProject.mainFile(root),
    'export const value: string = goUpper("plugin");\nconsole.log(value);\n',
    "utf8",
  );
  await start();
  assert.ok(await loader({ path: TestUnpluginProject.mainFile(root) }));
  assert.equal(compiles(), 2);

  await end();
  await start();
  assert.ok(await loader({ path: TestUnpluginProject.mainFile(root) }));
  assert.equal(
    compiles(),
    3,
    "a completed Bun build must dispose its generation before the next build",
  );
}
