import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the Farm, Rolldown, Rspack, and webpack entries expose factories,
 * and the webpack and Rspack shutdown hooks release the generation they share
 * (samchon/ttsc#1396).
 *
 * Webpack and Rspack keep one compiler alive across watch rebuilds and signal
 * its end only through `hooks.shutdown`. Compilers with equal options share one
 * generation, which outlives a compiler that shuts down while another still
 * holds it, and is released a short grace after the last one does. A generation
 * retained past that would serve a later build from a project state nothing
 * proved it against.
 *
 * 1. Assert each of the four adapter entries is a callable factory.
 * 2. Wire one plugin instance to a fake webpack compiler and one to a fake Rspack
 *    compiler, and assert each taps `shutdown` and `done` under the plugin's
 *    name and gains the source-map rule.
 * 3. Deliver the entry module and assert one compile. Shut the webpack compiler
 *    down, let the grace pass, and assert the Rspack compiler keeps the
 *    generation. Shut it down too and assert the next delivery compiles again.
 *
 * @evidence contracts/testing.md#behavioral-verification Four built entries are callable; webpack/Rspack tap named hooks and source-map rules, share one compile until both shut down, then next delivery compiles twice.
 * @evidence contracts/testing.md#independent-expectations Literal factory types/hook names and fixture byte counter fix expected wiring and ownership independently.
 * @evidence contracts/testing.md#distinguishing-cases Two equal-option compilers, one shuts down with survivor, final shutdown and grace expiry.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_adapter_entrypoints_expose_the_expected_plugin_factories is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built entries/native generation connect to captured webpack/Rspack compilers; actual host hook dispatch is simulated.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: four built entries are callable; webpack/Rspack tap named hooks and source-map rules, share one compile until both shut down, then next delivery compiles twice. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_adapter_entrypoints_expose_the_expected_plugin_factories(): Promise<void> {
  const unpluginFarm = await TestUnpluginRuntime.loadUnpluginAdapter("farm");
  const unpluginRolldown =
    await TestUnpluginRuntime.loadUnpluginAdapter("rolldown");
  const unpluginRspack =
    await TestUnpluginRuntime.loadUnpluginAdapter("rspack");
  const unpluginWebpack =
    await TestUnpluginRuntime.loadUnpluginAdapter("webpack");
  assert.equal(typeof unpluginFarm, "function");
  assert.equal(typeof unpluginRolldown, "function");
  assert.equal(typeof unpluginRspack, "function");
  assert.equal(typeof unpluginWebpack, "function");

  const { unplugin } = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const runLog = path.join(root, "dist", "compiles.bin");
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins.push({
    transform: "./plugin.cjs",
    name: "runs",
    operation: "count-runs",
    runLog,
  });
  fs.mkdirSync(path.dirname(runLog), { recursive: true });
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const sourceFile = TestUnpluginProject.mainFile(root);
  const source = fs.readFileSync(sourceFile, "utf8");
  for (const framework of ["webpack", "rspack"] as const) {
    assert.equal(typeof unplugin[framework], "function");
  }
  // Options of this project alone, so no other test's compiler shares the
  // generation.
  const options = { project: tsconfig };
  const disposals = new Map<"webpack" | "rspack", () => void>();
  let raw: any;
  for (const framework of ["webpack", "rspack"] as const) {
    const plugin = unplugin.raw(options, {
      framework,
      [framework]: { compiler: {} },
    } as never);
    raw ??= plugin;
    let registeredName: string | undefined;
    // Each compile's end, where the adapter reports what the compilation
    // depends on to the session's bridge.
    let doneName: string | undefined;
    const rules: unknown[] = [];
    plugin[framework]?.({
      options: { module: { rules } },
      hooks: {
        done: {
          tap(name: string) {
            doneName = name;
          },
        },
        shutdown: {
          tap(name: string, callback: () => void) {
            registeredName = name;
            disposals.set(framework, callback);
          },
        },
      },
    } as never);
    assert.equal(registeredName, "ttsc-unplugin", framework);
    assert.equal(doneName, "ttsc-unplugin", framework);
    assert.equal(typeof disposals.get(framework), "function", framework);
    assert.equal(rules.length, 1, `${framework} gains the source-map rule`);
  }
  const context = { addWatchFile(_file: string) {} };
  assert.equal(typeof raw.transform, "function");
  const deliver = async (): Promise<void> => {
    const result = await (
      raw.transform as unknown as (
        this: typeof context,
        source: string,
        id: string,
      ) => Promise<string | { code: string } | undefined>
    ).call(context, source, sourceFile);
    const code = typeof result === "string" ? result : result?.code;
    assert.ok(typeof code === "string");
    TestUnpluginProject.assertTransformedToPlugin(code);
  };
  const grace = () => new Promise((resolve) => setTimeout(resolve, 2_500));
  const compiles = () => fs.statSync(runLog).size;
  await deliver();
  assert.equal(compiles(), 1, "the cold delivery compiles once");
  disposals.get("webpack")!();
  await grace();
  await deliver();
  assert.equal(compiles(), 1, "the Rspack compiler still holds the generation");
  disposals.get("rspack")!();
  await grace();
  await deliver();
  assert.equal(compiles(), 2, "the last shutdown releases the generation");
}
