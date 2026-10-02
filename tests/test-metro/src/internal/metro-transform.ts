import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "@ttsc/testing";

import { createBareProject, prepareSnapshot } from "./metro-cache";
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
 * Asserts `getCacheKey` is a stable 64-char hex digest, equal across calls for
 * the same options and different when the options differ. The project carries a
 * prepared snapshot: key stability is only guaranteed on the `withTtsc` setup
 * path (without a snapshot the key soundly folds a per-run nonce).
 */
export async function assertCacheKeyIsDeterministicAndOptionSensitive(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const fake = TestMetroRuntime.fakeUpstreamPathOnDisk();
  const first = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake, exclude: ["a"] },
    (mod) => mod.getCacheKey({ projectRoot: root }),
  );
  const repeat = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake, exclude: ["a"] },
    (mod) => mod.getCacheKey({ projectRoot: root }),
  );
  const other = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake, exclude: ["b"] },
    (mod) => mod.getCacheKey({ projectRoot: root }),
  );
  assert.equal(typeof first, "string");
  assert.equal(first.length, 64);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, repeat);
  assert.notEqual(first, other);
}

/**
 * Asserts `getCacheKey` forwards Metro's arguments to the upstream
 * `getCacheKey` (so a babelrc-lookup change busts the key) and still produces a
 * valid key when the upstream exposes no `getCacheKey`. The two keys share one
 * snapshot-backed `projectRoot`, so only the upstream's contribution can differ
 * — the fingerprint ignores `enableBabelRCLookup`.
 */
export async function assertCacheKeyForwardsAndFoldsUpstreamKey(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const fake = TestMetroRuntime.fakeUpstreamPathOnDisk();
  const keyA = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake },
    (mod) => mod.getCacheKey({ projectRoot: root, enableBabelRCLookup: true }),
  );
  const keyB = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: fake },
    (mod) => mod.getCacheKey({ projectRoot: root, enableBabelRCLookup: false }),
  );
  // Forwarded args reach the upstream getCacheKey → different inputs, different key.
  assert.notEqual(keyA, keyB);

  // An upstream without getCacheKey still yields a valid key (no-upstream branch).
  const noKey = TestMetroRuntime.fakeUpstreamWithoutCacheKeyOnDisk();
  const keyC = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: noKey },
    (mod) => mod.getCacheKey({ projectRoot: root, enableBabelRCLookup: true }),
  );
  assert.equal(typeof keyC, "string");
  assert.equal(keyC.length, 64);
  const keyCRepeat = await TestMetroRuntime.withTransformerEnv(
    { upstreamTransformer: noKey },
    (mod) => mod.getCacheKey({ projectRoot: root, enableBabelRCLookup: true }),
  );
  assert.equal(keyC, keyCRepeat, "an absent optional callback retains reuse");
}

/**
 * Asserts `getCacheKey` does not throw when the configured upstream cannot be
 * resolved: cache-key computation must degrade, not crash the whole build.
 */
export async function assertCacheKeySurvivesMissingUpstream(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const keyForRun = () =>
    TestMetroRuntime.withTransformerEnv(
      { upstreamTransformer: "@@ttsc-metro-nonexistent-upstream@@" },
      (mod) => mod.getCacheKey({ projectRoot: root }),
    );
  const key = await keyForRun();
  assert.equal(typeof key, "string");
  assert.match(key, /^[0-9a-f]{64}$/);
  const repeat = await keyForRun();
  assert.match(repeat, /^[0-9a-f]{64}$/);
  assert.notEqual(key, repeat, "missing upstream withdraws reuse");
}

/**
 * Asserts `getCacheKey` does not throw when the upstream's own `getCacheKey`
 * throws: the inner guard must swallow it and still produce a valid key.
 */
export async function assertCacheKeySurvivesThrowingUpstreamCacheKey(): Promise<void> {
  const root = createBareProject();
  await prepareSnapshot(root);
  const throwing = TestMetroRuntime.fakeUpstreamThrowingCacheKeyOnDisk();
  const keyForRun = () =>
    TestMetroRuntime.withTransformerEnv(
      { upstreamTransformer: throwing },
      (mod) => mod.getCacheKey({ projectRoot: root }),
    );
  const key = await keyForRun();
  assert.equal(typeof key, "string");
  assert.match(key, /^[0-9a-f]{64}$/);
  const repeat = await keyForRun();
  assert.match(repeat, /^[0-9a-f]{64}$/);
  assert.notEqual(key, repeat, "a failed upstream key withdraws reuse");
}

/** One file the gate must reject, with the options that reject it. */
interface GatedOutCase {
  name: string;
  options: Record<string, unknown>;
  params: { src: string; filename: string; options: Record<string, unknown> };
}

/**
 * Asserts every gated-out file reaches the upstream as Metro's own params
 * object.
 *
 * The ttsc pass hands the upstream a fresh `{ ...params, src }`, while a file
 * that bypasses it is forwarded as the object Metro supplied. A recording
 * upstream keeps what it was handed, so identity with the object given to
 * `transform` shows the pass did not run, which equal source text alone cannot.
 * The gate reads the project-relative filename, so a relative file whose
 * absolute path contains an include word is still outside that include.
 */
export async function assertGatedOutFilesReachTheUpstreamAsTheOriginalParams(): Promise<void> {
  const KEY = "__ttscMetroRecordedUpstreamParams";
  const dir = TestProject.tmpdir("ttsc-metro-upstream-recording-");
  const upstream = path.join(dir, "upstream.cjs");
  fs.writeFileSync(
    upstream,
    [
      "exports.transform = async function (params) {",
      `  globalThis[${JSON.stringify(KEY)}] = params;`,
      "  return { ast: { __recording: true } };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  const cases: GatedOutCase[] = [
    {
      name: "javascript",
      options: {},
      params: {
        src: "export const a = 1;\n",
        filename: path.join(ROOT, "src", "app.js"),
        options: {},
      },
    },
    {
      name: "declaration",
      options: {},
      params: {
        src: "declare const a: number;\n",
        filename: path.join(ROOT, "src", "types.d.ts"),
        options: {},
      },
    },
    {
      name: "excluded",
      options: { exclude: ["generated"] },
      params: {
        src: "export const a: 1 = 1;\n",
        filename: path.join(ROOT, "src", "generated", "api.ts"),
        options: {},
      },
    },
    {
      name: "not included",
      options: { include: ["src/included"] },
      params: {
        src: "export const a: 1 = 1;\n",
        filename: path.join(ROOT, "src", "other", "file.ts"),
        options: {},
      },
    },
    {
      name: "relative file below a root named like the include",
      options: { include: ["generated"] },
      params: {
        src: "export const a: 1 = 1;\n",
        filename: path.join("src", "app.ts"),
        options: { projectRoot: path.join(ROOT, "generated") },
      },
    },
  ];
  const holder = globalThis as unknown as Record<string, unknown>;
  try {
    for (const { name, options, params } of cases) {
      delete holder[KEY];
      await TestMetroRuntime.withTransformerEnv(
        { upstreamTransformer: upstream, ...options },
        (mod) => mod.transform(params),
      );
      assert.equal(
        holder[KEY],
        params,
        `${name}: the upstream must receive the original params object`,
      );
    }
  } finally {
    delete holder[KEY];
  }
}
