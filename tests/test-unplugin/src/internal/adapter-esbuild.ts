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
  const firstEnd = observeDispose();
  const secondEnd = observeDispose();
  const firstContext = await esbuild.context({
    ...options,
    plugins: [plugin, firstEnd.plugin],
  });
  const secondContext = await esbuild.context({
    ...options,
    plugins: [plugin, secondEnd.plugin],
  });
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
    await firstEnd.disposed;
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
    await secondEnd.disposed;

    const firstBuildEnd = observeDispose();
    const replacementEnd = observeDispose();
    let startReplacement!: () => void;
    let releaseReplacement!: () => void;
    const replacementStarted = new Promise<void>((resolve) => {
      startReplacement = resolve;
    });
    const replacementReleased = new Promise<void>((resolve) => {
      releaseReplacement = resolve;
    });
    let replacement: Promise<any> | undefined;
    try {
      const first = await esbuild.build({
        ...options,
        plugins: [
          plugin,
          firstBuildEnd.plugin,
          {
            name: "overlap-build-lifetimes",
            setup(build: any) {
              build.onEnd(async () => {
                replacement = esbuild.build({
                  ...options,
                  plugins: [
                    plugin,
                    replacementEnd.plugin,
                    {
                      name: "hold-active-replacement",
                      setup(next: any) {
                        next.onStart(() => {
                          startReplacement();
                          return replacementReleased;
                        });
                      },
                    },
                  ],
                });
                await replacementStarted;
              });
            },
          },
        ],
      });
      TestUnpluginProject.assertTransformedToPlugin(first.outputFiles[0].text);
      assert.equal(
        fs.statSync(runLog).size,
        2,
        "last-context disposal must release its generation",
      );
      await firstBuildEnd.disposed;
      releaseReplacement();
      const next = await replacement;
      TestUnpluginProject.assertTransformedToPlugin(next.outputFiles[0].text);
      assert.equal(
        fs.statSync(runLog).size,
        2,
        "an older one-shot disposal must retain the active replacement",
      );
      await replacementEnd.disposed;
    } finally {
      releaseReplacement();
      await replacement;
    }

    const finalEnd = observeDispose();
    const afterOneShotDispose = await esbuild.build({
      ...options,
      plugins: [plugin, finalEnd.plugin],
    });
    TestUnpluginProject.assertTransformedToPlugin(
      afterOneShotDispose.outputFiles[0].text,
    );
    assert.equal(
      fs.statSync(runLog).size,
      3,
      "the final one-shot disposal must release the generation",
    );
    await finalEnd.disposed;
  } finally {
    if (!firstDisposed) await firstContext.dispose();
    if (!secondDisposed) await secondContext.dispose();
  }
}

/** Observe the public host lifecycle without intercepting global timers. */
function observeDispose() {
  let done!: () => void;
  const disposed = new Promise<void>((resolve) => {
    done = resolve;
  });
  return {
    disposed,
    plugin: {
      name: "observe-disposal",
      setup(build: { onDispose(callback: () => void): void }) {
        build.onDispose(done);
      },
    },
  };
}

export { assertEsbuildAdapterTransformsSource };
