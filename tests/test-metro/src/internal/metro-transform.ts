import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { TestMetroRuntime } from "./metro-runtime";

const ROOT = "/workspace/app";

/** Options that route every transform to the echoing fake upstream. */
function fakeUpstreamOptions(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
    ...extra,
  };
}

/**
 * Asserts a JavaScript file skips the ttsc pass and reaches the upstream
 * transformer with its source untouched. The ttsc pass only handles TypeScript;
 * everything else must pass straight through.
 */
export async function assertPassesJavaScriptThrough(): Promise<void> {
  const src = "export const value = 1;\n";
  const filename = path.join(ROOT, "src", "app.js");
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions(),
    params: { src, filename, options: { dev: true } },
  });
  assert.equal(result.ast.__fakeUpstream, true);
  assert.equal(result.ast.src, src);
  assert.equal(result.ast.filename, filename);
}

/**
 * Asserts a declaration file passes straight through. The negative twin of the
 * "transforms TypeScript" path: `.d.ts` files carry no runtime code and must
 * never be fed to the ttsc project transform.
 */
export async function assertPassesDeclarationThrough(): Promise<void> {
  const src = "declare const ambient: number;\n";
  const filename = path.join(ROOT, "src", "types.d.ts");
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions(),
    params: { src, filename, options: {} },
  });
  assert.equal(result.ast.src, src);
}

/**
 * Asserts an excluded TypeScript file passes straight through. The negative
 * twin of a transformed file: same `.ts` extension, but a path matching an
 * `exclude` pattern must bypass the ttsc pass.
 */
export async function assertExcludedPathPassesThrough(): Promise<void> {
  const src = 'export const value: string = "x";\n';
  const filename = path.join(ROOT, "src", "generated", "api.ts");
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions({ exclude: ["generated"] }),
    params: { src, filename, options: {} },
  });
  assert.equal(result.ast.src, src);
}

/**
 * Asserts that when `include` is set, a TypeScript file outside every include
 * pattern passes straight through. Pins the include boundary: only matching
 * paths enter the ttsc pass.
 */
export async function assertNonIncludedPathPassesThrough(): Promise<void> {
  const src = 'export const value: string = "x";\n';
  const filename = path.join(ROOT, "src", "other", "file.ts");
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions({ include: ["src/included"] }),
    params: { src, filename, options: {} },
  });
  assert.equal(result.ast.src, src);
}

/**
 * Asserts every Metro transform parameter — not just `src`/`filename` — reaches
 * the upstream transformer. A custom transformer that dropped `options` or
 * sibling fields would break Metro's downstream Babel stage.
 */
export async function assertForwardsAllParamsToUpstream(): Promise<void> {
  const filename = path.join(ROOT, "src", "app.js");
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions(),
    params: {
      src: "export const value = 1;\n",
      filename,
      options: { hot: true, platform: "ios" },
      plugins: ["babel-plugin-foo"],
    },
  });
  assert.deepEqual(result.ast.options, { hot: true, platform: "ios" });
  assert.deepEqual(result.ast.plugins, ["babel-plugin-foo"]);
}

/**
 * Asserts a missing configured upstream transformer fails loudly rather than
 * silently dropping the file. Upstream resolution happens before filtering, so
 * even a pass-through file surfaces the error.
 */
export async function assertMissingUpstreamThrows(): Promise<void> {
  await assert.rejects(
    TestMetroRuntime.runTransform({
      options: { upstreamTransformer: "@@ttsc-metro-nonexistent-upstream@@" },
      params: {
        src: "export const value = 1;\n",
        filename: path.join(ROOT, "src", "app.js"),
        options: {},
      },
    }),
    /Could not load the configured upstream transformer/,
  );
}

/**
 * End-to-end: asserts the ttsc plugin pass actually runs on a TypeScript source
 * and the transformed source is what reaches the upstream transformer.
 *
 * Uses the shared fixture project (a Go plugin that uppercases the `goUpper`
 * call) and the echoing fake upstream, then asserts the source handed
 * downstream was plugin-transformed. Exercises the real native compiler, so it
 * runs in CI (Go toolchain present), not in a Go-less local checkout.
 */
export async function assertRunsTtscPluginPassOnTypeScript(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions(),
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: TestUnpluginProject.mainFile(root),
      options: {},
    },
  });
  assert.equal(result.ast.__fakeUpstream, true);
  TestUnpluginProject.assertTransformedToPlugin(result.ast.src as string);
}
