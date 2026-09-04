import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const esbuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("esbuild");

/**
 * Asserts that running a real esbuild build with the unplugin esbuild adapter
 * produces plugin-transformed output.
 *
 * Runs two esbuild contexts in-process with one adapter instance. Disposing the
 * first must not clear the generation still owned by the second; disposing the
 * last must make a later one-shot build compile afresh. This covers rebuild
 * reuse, overlapping setup ownership, context disposal, and one-shot disposal
 * without another process or test entrypoint.
 */
async function assertEsbuildAdapterTransformsSource() {
  const unpluginEsbuild =
    await TestUnpluginRuntime.loadUnpluginAdapter("esbuild");
  const root = TestUnpluginProject.createProject();
  const runLog = path.join(root, "dist", "compiles.bin");
  fs.mkdirSync(path.dirname(runLog), { recursive: true });
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins = [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "go-uppercase",
    },
    {
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog,
    },
  ];
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const plugin = unpluginEsbuild();
  const options = {
    absWorkingDir: root,
    bundle: false,
    entryPoints: ["src/main.ts"],
    format: "cjs" as const,
    logLevel: "silent" as const,
    plugins: [plugin],
    write: false,
  };
  const firstContext = await esbuild.context(options);
  const secondContext = await esbuild.context(options);
  let firstDisposed = false;
  let secondDisposed = false;
  try {
    const first = await firstContext.rebuild();
    TestUnpluginProject.assertTransformedToPlugin(first.outputFiles[0].text);
    assert.equal(
      fs.statSync(runLog).size,
      1,
      "the first context compiles once",
    );

    await firstContext.dispose();
    firstDisposed = true;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const overlapping = await secondContext.rebuild();
    TestUnpluginProject.assertTransformedToPlugin(
      overlapping.outputFiles[0].text,
    );
    assert.equal(
      fs.statSync(runLog).size,
      1,
      "disposing one context must retain a generation owned by another",
    );

    await secondContext.dispose();
    secondDisposed = true;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const afterDispose = await esbuild.build(options);
    TestUnpluginProject.assertTransformedToPlugin(
      afterDispose.outputFiles[0].text,
    );
    assert.equal(
      fs.statSync(runLog).size,
      2,
      "the last context disposal must release the generation",
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const afterOneShotDispose = await esbuild.build(options);
    TestUnpluginProject.assertTransformedToPlugin(
      afterOneShotDispose.outputFiles[0].text,
    );
    assert.equal(
      fs.statSync(runLog).size,
      3,
      "one-shot disposal must release its generation",
    );
  } finally {
    if (!firstDisposed) await firstContext.dispose();
    if (!secondDisposed) await secondContext.dispose();
  }
}

export { assertEsbuildAdapterTransformsSource };
