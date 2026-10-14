import type { BuildOptions, Plugin as EsbuildPlugin } from "esbuild";
import assert from "node:assert/strict";

import { isTransformTarget } from "../../../../packages/unplugin/src/core/isTransformTarget";
import { installViteDependencyScanPlugins } from "../../../../packages/unplugin/src/core/vite/installViteDependencyScanPlugins";

/**
 * Verifies optimizer registration preserves host options and transforms only source modules owned by ttsc.
 *
 * The scanner has its own plugin population; registering there must preserve user hooks and environment settings without enabling disabled discovery.
 *
 * 1. Install into shared and independent Rolldown environment settings, invoke
 *    their registered transforms and verify existing hooks remain callable.
 * 2. Deliver TypeScript, declarations, dependency and wrapper ids; assert
 *    transformation, pass-through and failure identity.
 * 3. Check esbuild options remain intact and build or disabled-discovery settings
 *    receive no additional scanner.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes registered optimizer transform callbacks and original hooks, checking transformed code, exact requests, failure identity, deduplication and preservation of optimizer settings.
 * @evidence contracts/testing.md#independent-expectations Authored source and transformed text, callback counts and user option identities specify the scanner handoff independently of its implementation.
 * @evidence contracts/testing.md#distinguishing-cases Covers shared and independent environments, prior hook arrays, absent hook lists, TS and queried ids, declarations, node_modules, wrappers, unchanged output, rejection, esbuild options, build mode and every disabled-discovery form.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit invokes authored configuration and callback seams in memory; the Vite optimizer E2E owns native parsing, package resolution and actual optimization results.
 */
export async function test_vite_dependency_scan_preserves_optimizer_ownership(): Promise<void> {
  let priorCalls = 0;
  const prior = {
    name: "prior-optimizer",
    transform: () => {
      priorCalls += 1;
      return "prior";
    },
  };
  const include = ["kept"];
  const exclude = ["excluded"];
  const options = {
    include,
    exclude,
    rolldownOptions: { plugins: [prior] as unknown },
  };
  const other = { rolldownOptions: {} as { plugins?: unknown } };
  const delivered: [string, string][] = [];
  const failure = new Error("compile failure");
  installViteDependencyScanPlugins(
    {
      command: "serve",
      optimizeDeps: options,
      environments: {
        client: { optimizeDeps: options },
        linked: { optimizeDeps: { rolldownOptions: options.rolldownOptions } },
        ssr: { optimizeDeps: other },
      },
    },
    isTransformTarget,
    async (source, file) => {
      delivered.push([source, file]);
      if (source === "fail") throw failure;
      if (source === "unchanged") return;
      return { code: 'import "injected/deep";\n' };
    },
    "rolldown",
  );
  const plugins = options.rolldownOptions.plugins as [
    (typeof prior)[],
    {
      transform: (source: string, file: string) => Promise<unknown>;
    },
  ];
  assert.equal(plugins.length, 2, "a shared settings object gets one scanner");
  assert.equal(plugins[0][0], prior);
  assert.equal(plugins[0][0]!.transform(), "prior");
  assert.equal(priorCalls, 1);
  assert.equal(options.include, include);
  assert.equal(options.exclude, exclude);
  assert.deepEqual(
    await plugins[1].transform("source", "/workspace/main.ts?t=1"),
    {
      code: 'import "injected/deep";\n',
    },
  );
  assert.deepEqual(delivered, [["source", "/workspace/main.ts"]]);
  for (const file of [
    "/workspace/types.d.ts",
    "/workspace/types.d.mts",
    "/workspace/node_modules/lib/index.ts",
    "/workspace/main.ts?raw",
    "/workspace/main.ts?worker",
    "/workspace/main.js",
    "\0virtual.ts",
  ]) {
    assert.equal(await plugins[1].transform("excluded", file), undefined);
  }
  assert.equal(delivered.length, 1);
  assert.equal(
    await plugins[1].transform("unchanged", "/workspace/main.ts"),
    undefined,
  );
  await assert.rejects(
    plugins[1].transform("fail", "/workspace/main.ts"),
    (error) => error === failure,
  );
  const otherPlugins = other.rolldownOptions.plugins as typeof plugins;
  assert.equal(otherPlugins.length, 1);

  const original: EsbuildPlugin = { name: "user", setup() {} };
  const esbuildOptions: BuildOptions = {
    define: { KEPT: "true" },
    plugins: [original],
    loader: { ".ts": "ts" },
  };
  const dormantRolldown = { plugins: [prior] as unknown };
  const esbuildSettings = { esbuildOptions, rolldownOptions: dormantRolldown };
  installViteDependencyScanPlugins(
    { command: "serve", optimizeDeps: esbuildSettings },
    isTransformTarget,
    async () => undefined,
    "esbuild",
  );
  assert.equal(esbuildSettings.esbuildOptions, esbuildOptions);
  assert.equal(esbuildOptions.plugins!.length, 3);
  assert.equal(esbuildOptions.plugins![1], original);
  assert.deepEqual(
    dormantRolldown.plugins,
    [prior],
    "unused backend options do not select the scanner",
  );
  assert.deepEqual(esbuildOptions.define, { KEPT: "true" });
  assert.deepEqual(esbuildOptions.loader, { ".ts": "ts" });

  for (const setting of [
    { noDiscovery: true },
    { disabled: true as const },
    { disabled: "dev" as const },
  ]) {
    const untouched = { ...setting, esbuildOptions: { plugins: [original] } };
    installViteDependencyScanPlugins(
      { command: "serve", optimizeDeps: untouched },
      isTransformTarget,
      async () => undefined,
      "esbuild",
    );
    assert.deepEqual(untouched.esbuildOptions.plugins, [original]);
  }
  const build = { esbuildOptions: { plugins: [original] } };
  installViteDependencyScanPlugins(
    { command: "build", optimizeDeps: build },
    isTransformTarget,
    async () => undefined,
    "esbuild",
  );
  assert.deepEqual(build.esbuildOptions.plugins, [original]);
}
