import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies that the farm, rolldown, rspack, and webpack adapter entrypoints
 * each resolve to a callable factory function. It also fills one raw plugin
 * cache and proves that both webpack-like shutdown hooks clear it before the
 * next delivery, without starting another test process.
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
  const raw = unplugin.raw(undefined, {
    framework: "webpack",
    webpack: { compiler: {} },
  } as never);
  const disposals = new Map<"webpack" | "rspack", () => void>();
  for (const framework of ["webpack", "rspack"] as const) {
    let registeredName: string | undefined;
    raw[framework]?.({
      hooks: {
        shutdown: {
          tap(name: string, callback: () => void) {
            registeredName = name;
            disposals.set(framework, callback);
          },
        },
      },
    } as never);
    assert.equal(registeredName, "ttsc-unplugin", framework);
    assert.equal(typeof disposals.get(framework), "function", framework);
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
  try {
    await deliver();
    assert.equal(
      fs.statSync(runLog).size,
      1,
      "the cold delivery compiles once",
    );
    for (const framework of ["webpack", "rspack"] as const) {
      disposals.get(framework)?.();
      await deliver();
      assert.equal(
        fs.statSync(runLog).size,
        framework === "webpack" ? 2 : 3,
        `${framework} shutdown must clear the generation`,
      );
    }
  } finally {
    for (const dispose of disposals.values()) dispose();
  }
}
