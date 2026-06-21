import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
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

/** A fully-resolved options object for `shouldTransform` unit tests. */
function resolvedOptions(extra: Record<string, unknown> = {}): any {
  return {
    ttsc: {},
    include: [],
    exclude: [],
    upstreamTransformer: undefined,
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
 * Asserts every Metro transform parameter (not just `src`/`filename`) reaches
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
  // Mirror real Metro: a project-relative `filename` plus `projectRoot` in
  // options. This exercises the relative→absolute resolution; resolving against
  // cwd instead of projectRoot would make the file look outside the project and
  // silently skip the plugin pass.
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions(),
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root, platform: "ios" },
      plugins: ["babel-plugin-foo"],
    },
  });
  assert.equal(result.ast.__fakeUpstream, true);
  TestUnpluginProject.assertTransformedToPlugin(result.ast.src as string);
  // The transform-path spread must preserve sibling params (options/plugins),
  // not just `src`, a regression dropping them would break Metro's Babel stage.
  assert.equal((result.ast.options as Record<string, unknown>).platform, "ios");
  assert.deepEqual(result.ast.plugins, ["babel-plugin-foo"]);
}

/**
 * Asserts Metro's project-relative `filename` is resolved against
 * `options.projectRoot` (not `process.cwd()`). The core of the silent-no-op
 * bug: in monorepos cwd ≠ projectRoot, so resolving against cwd points the ttsc
 * pass at the wrong path and every file looks "outside the project".
 */
export async function assertResolvesRelativeFilenameAgainstProjectRoot(): Promise<void> {
  const mod = await TestMetroRuntime.loadFreshTransformer();
  assert.equal(
    mod.resolveAbsoluteFilename("src/app.ts", {
      projectRoot: "/workspace/app",
    }),
    path.resolve("/workspace/app", "src/app.ts"),
  );
  // No projectRoot → falls back to cwd.
  assert.equal(
    mod.resolveAbsoluteFilename("src/app.ts", {}),
    path.resolve(process.cwd(), "src/app.ts"),
  );
  // No options object at all → also falls back to cwd.
  assert.equal(
    mod.resolveAbsoluteFilename("src/app.ts"),
    path.resolve(process.cwd(), "src/app.ts"),
  );
}

/**
 * Asserts an already-absolute `filename` is returned unchanged, ignoring
 * `projectRoot` (the `path.isAbsolute` short-circuit).
 */
export async function assertKeepsAbsoluteFilenameUnchanged(): Promise<void> {
  const mod = await TestMetroRuntime.loadFreshTransformer();
  const absolute = path.resolve("/workspace/app/src/app.ts");
  assert.equal(
    mod.resolveAbsoluteFilename(absolute, { projectRoot: "/somewhere/else" }),
    absolute,
  );
}

/**
 * Asserts `shouldTransform` accepts every TypeScript source extension
 * (`.ts`/`.tsx`/`.cts`/`.mts`).
 */
export async function assertAcceptsAllTypeScriptExtensions(): Promise<void> {
  const mod = await TestMetroRuntime.loadFreshTransformer();
  for (const file of ["/p/a.ts", "/p/a.tsx", "/p/a.cts", "/p/a.mts"]) {
    assert.equal(mod.shouldTransform(file, resolvedOptions()), true, file);
  }
}

/**
 * Asserts `shouldTransform` rejects declaration files and non-TypeScript
 * extensions (`.d.ts`/`.d.mts`, `.js`/`.jsx`, `.json`, `.css`): they pass
 * straight through to the upstream transformer.
 */
export async function assertRejectsNonTypeScriptExtensions(): Promise<void> {
  const mod = await TestMetroRuntime.loadFreshTransformer();
  for (const file of [
    "/p/a.d.ts",
    "/p/a.d.mts",
    "/p/a.js",
    "/p/a.jsx",
    "/p/a.json",
    "/p/a.css",
  ]) {
    assert.equal(mod.shouldTransform(file, resolvedOptions()), false, file);
  }
}

/**
 * Asserts the include/exclude gating: empty include = all TypeScript; a
 * matching include selects, a non-matching include rejects; exclude rejects and
 * wins over a matching include.
 */
export async function assertGatesByIncludeAndExclude(): Promise<void> {
  const mod = await TestMetroRuntime.loadFreshTransformer();
  const ts = "/p/src/keep/a.ts";
  assert.equal(
    mod.shouldTransform(ts, resolvedOptions()),
    true,
    "empty include",
  );
  assert.equal(
    mod.shouldTransform(ts, resolvedOptions({ include: ["keep"] })),
    true,
    "include match",
  );
  assert.equal(
    mod.shouldTransform(
      "/p/src/other/a.ts",
      resolvedOptions({ include: ["keep"] }),
    ),
    false,
    "include non-match",
  );
  assert.equal(
    mod.shouldTransform(ts, resolvedOptions({ exclude: ["keep"] })),
    false,
    "exclude match",
  );
  assert.equal(
    mod.shouldTransform(
      ts,
      resolvedOptions({ include: ["keep"], exclude: ["keep"] }),
    ),
    false,
    "exclude wins over include",
  );
}

/**
 * Asserts `getCacheKey` is a stable 64-char hex digest, equal across calls for
 * the same options and different when the options differ.
 */
export async function assertCacheKeyIsDeterministicAndOptionSensitive(): Promise<void> {
  const fake = TestMetroRuntime.fakeUpstreamPathOnDisk();
  const first = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake, exclude: ["a"] },
    (mod) => mod.getCacheKey(),
  );
  const repeat = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake, exclude: ["a"] },
    (mod) => mod.getCacheKey(),
  );
  const other = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake, exclude: ["b"] },
    (mod) => mod.getCacheKey(),
  );
  assert.equal(typeof first, "string");
  assert.equal(first.length, 64);
  assert.equal(first, repeat);
  assert.notEqual(first, other);
}

/**
 * Asserts `getCacheKey` forwards Metro's arguments to the upstream
 * `getCacheKey` (so a `projectRoot`/babelrc change busts the key) and still
 * produces a valid key when the upstream exposes no `getCacheKey`.
 */
export async function assertCacheKeyForwardsAndFoldsUpstreamKey(): Promise<void> {
  const fake = TestMetroRuntime.fakeUpstreamPathOnDisk();
  const keyA = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake },
    (mod) => mod.getCacheKey({ projectRoot: "/a" }),
  );
  const keyB = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake },
    (mod) => mod.getCacheKey({ projectRoot: "/b" }),
  );
  // Forwarded args reach the upstream getCacheKey → different inputs, different key.
  assert.notEqual(keyA, keyB);

  // An upstream without getCacheKey still yields a valid key (no-upstream branch).
  const noKey = TestMetroRuntime.fakeUpstreamWithoutCacheKeyOnDisk();
  const keyC = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: noKey },
    (mod) => mod.getCacheKey({ projectRoot: "/a" }),
  );
  assert.equal(typeof keyC, "string");
  assert.equal(keyC.length, 64);
}

/**
 * Asserts `getCacheKey` does not throw when the configured upstream cannot be
 * resolved: cache-key computation must degrade, not crash the whole build.
 */
export async function assertCacheKeySurvivesMissingUpstream(): Promise<void> {
  const key = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: "@@ttsc-metro-nonexistent-upstream@@" },
    (mod) => mod.getCacheKey({ projectRoot: "/a" }),
  );
  assert.equal(typeof key, "string");
  assert.equal(key.length, 64);
}

/**
 * Asserts `getCacheKey` does not throw when the upstream's own `getCacheKey`
 * throws: the inner guard must swallow it and still produce a valid key.
 */
export async function assertCacheKeySurvivesThrowingUpstreamCacheKey(): Promise<void> {
  const throwing = TestMetroRuntime.fakeUpstreamThrowingCacheKeyOnDisk();
  const key = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: throwing },
    (mod) => mod.getCacheKey({ projectRoot: "/a" }),
  );
  assert.equal(typeof key, "string");
  assert.equal(key.length, 64);
}

/**
 * End-to-end: asserts a file outside the tsconfig program passes through
 * untransformed rather than failing the build (the `isFileOutsideProject` =>
 * swallow path). Requires the native compiler → CI-only.
 */
export async function assertOutsideProjectFilePassesThrough(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const src = "export const value: number = 1;\n";
  fs.mkdirSync(path.join(root, "outside"), { recursive: true });
  fs.writeFileSync(path.join(root, "outside", "stray.ts"), src, "utf8");
  const result = await TestMetroRuntime.runTransform({
    options: fakeUpstreamOptions(),
    params: {
      src,
      filename: "outside/stray.ts",
      options: { projectRoot: root },
    },
  });
  assert.equal(result.ast.__fakeUpstream, true);
  assert.equal(result.ast.src, src);
}

/**
 * End-to-end: asserts a genuine compile/plugin failure propagates (the
 * `isFileOutsideProject` FALSE branch, rethrow), and is NOT swallowed as an
 * out-of-project case. Requires the native compiler → CI-only.
 */
export async function assertGenuineCompileErrorPropagates(): Promise<void> {
  const broken = "export const broken: number = 1;\n";
  const root = TestUnpluginProject.createProject({ source: broken });
  await assert.rejects(
    TestMetroRuntime.runTransform({
      options: fakeUpstreamOptions(),
      params: {
        src: broken,
        filename: "src/main.ts",
        options: { projectRoot: root },
      },
    }),
    // Load-bearing: must reject with the actual plugin error (mentions
    // goUpper), not the out-of-project swallow string, and not a vacuous
    // environment failure.
    (error: Error) =>
      /goUpper/.test(error.message) &&
      !/did not return output/.test(error.message),
  );
}
