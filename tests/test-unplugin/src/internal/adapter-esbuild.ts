import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const esbuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("esbuild");

/**
 * Asserts that running a real esbuild build with the unplugin esbuild adapter
 * produces plugin-transformed output.
 *
 * Runs failed setup, overlapping contexts, and overlapping one-shot builds
 * in-process with one adapter instance. It proves that only a build reaching
 * `onStart` acquires ownership and that delayed disposal cannot clear a newer
 * active owner, without another process or test entrypoint.
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
  await assert.rejects(
    esbuild.context({ ...options, format: "not-a-format" as never }),
    /Invalid value/,
    "a failure after plugin setup must not retain a cache owner",
  );
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
    const second = await secondContext.rebuild();
    TestUnpluginProject.assertTransformedToPlugin(second.outputFiles[0].text);
    assert.equal(
      fs.statSync(runLog).size,
      1,
      "the second active context shares the proven generation",
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

    const originalSetTimeout = globalThis.setTimeout;
    const delayedDisposals: Array<() => void> = [];
    globalThis.setTimeout = ((
      callback: (...arguments_: unknown[]) => void,
      delay?: number,
      ...arguments_: unknown[]
    ) => {
      const stack = new Error().stack ?? "";
      if (
        delay === 0 &&
        stack.includes("esbuild") &&
        stack.includes("scheduleOnDisposeCallbacks")
      ) {
        delayedDisposals.push(() => callback(...arguments_));
        return {} as ReturnType<typeof setTimeout>;
      }
      return originalSetTimeout(callback, delay, ...arguments_);
    }) as typeof setTimeout;
    try {
      const afterDispose = await esbuild.build(options);
      TestUnpluginProject.assertTransformedToPlugin(
        afterDispose.outputFiles[0].text,
      );
      assert.equal(
        fs.statSync(runLog).size,
        2,
        "the last context disposal must release the generation",
      );
      assert.equal(delayedDisposals.length, 1);

      let signalReplacementStart: (() => void) | undefined;
      const replacementStarted = new Promise<void>((resolve) => {
        signalReplacementStart = resolve;
      });
      const replacement = esbuild.build({
        ...options,
        plugins: [
          plugin,
          {
            name: "signal-replacement-start",
            setup(build: { onStart(callback: () => void): void }) {
              build.onStart(() => signalReplacementStart?.());
            },
          },
        ],
      });
      await replacementStarted;
      delayedDisposals.shift()?.();
      const overlappingOneShot = await replacement;
      TestUnpluginProject.assertTransformedToPlugin(
        overlappingOneShot.outputFiles[0].text,
      );
      assert.equal(
        fs.statSync(runLog).size,
        2,
        "an older delayed disposal must retain the active replacement",
      );
      assert.equal(delayedDisposals.length, 1);
      delayedDisposals.shift()?.();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      for (const dispose of delayedDisposals.splice(0)) dispose();
    }

    const afterOneShotDispose = await esbuild.build(options);
    TestUnpluginProject.assertTransformedToPlugin(
      afterOneShotDispose.outputFiles[0].text,
    );
    assert.equal(
      fs.statSync(runLog).size,
      3,
      "the final one-shot disposal must release the generation",
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  } finally {
    if (!firstDisposed) await firstContext.dispose();
    if (!secondDisposed) await secondContext.dispose();
  }
}

export { assertEsbuildAdapterTransformsSource };
