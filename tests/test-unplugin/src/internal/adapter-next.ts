import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

const LOADER = "@ttsc/unplugin/turbopack";

interface INextLikeConfig {
  turbopack?: { rules?: Record<string, unknown> };
  webpack?: (config: { plugins?: unknown[] }, options: unknown) => unknown;
  [key: string]: unknown;
}

/** Load the built `next` adapter entry. */
async function loadNext(): Promise<
  (config?: INextLikeConfig, options?: unknown) => INextLikeConfig
> {
  return (await TestUnpluginRuntime.loadUnpluginAdapter("next")) as (
    config?: INextLikeConfig,
    options?: unknown,
  ) => INextLikeConfig;
}

/** The loader entries a rule carries, in either shape Turbopack accepts. */
function loadersOf(rule: unknown): unknown[] {
  if (Array.isArray(rule)) return rule;
  if (typeof rule === "object" && rule !== null) {
    const loaders = (rule as { loaders?: unknown }).loaders;
    if (Array.isArray(loaders)) return loaders;
  }
  return [];
}

/** Whether an entry names this package's Turbopack loader. */
function isTtscLoader(entry: unknown): boolean {
  if (typeof entry === "string") return entry === LOADER;
  return (
    typeof entry === "object" &&
    entry !== null &&
    (entry as { loader?: unknown }).loader === LOADER
  );
}

/**
 * Asserts `withTtsc` wires Turbopack as well as webpack, with the same options.
 *
 * The wrapper injected the webpack plugin and nothing else, so a project on
 * Turbopack got no transform at all and no error: the build succeeded and every
 * plugin-driven construct in it survived untransformed into a runtime failure
 * (samchon/ttsc#1310). Turbopack is the default bundler in the Next majors this
 * repository pins, so the covered path was the one fewer users are on.
 *
 * Options must reach both halves identically, since a wrapper that wires two
 * bundlers differently is its own defect.
 */
export async function assertNextAdapterWiresBothBundlers(): Promise<void> {
  const next = await loadNext();
  const options = { project: "tsconfig.build.json" };
  const config = next({}, options);

  const rules = config.turbopack?.rules ?? {};
  for (const glob of ["*.ts", "*.tsx"]) {
    const loaders = loadersOf(rules[glob]);
    assert.ok(
      loaders.some(isTtscLoader),
      `${glob} must route through ${LOADER}`,
    );
    const entry = loaders.find(isTtscLoader) as { options?: unknown };
    assert.deepEqual(
      entry.options,
      options,
      `${glob} must receive the wrapper's own options`,
    );
  }

  // The webpack half is unchanged and must stay so.
  const webpackConfig = config.webpack?.({ plugins: [] }, {}) as {
    plugins: unknown[];
  };
  assert.equal(
    webpackConfig.plugins.length,
    1,
    "the webpack plugin must still be injected",
  );
}

/**
 * Asserts the wrapper is additive: it preserves a caller's Turbopack
 * configuration and never registers its loader twice.
 *
 * The README told users to wire `turbopack.rules` by hand, so a project
 * adopting the wrapper afterwards would carry both. Registering the loader
 * twice would transform every module twice, which is worse than the silence it
 * replaces, and discarding the caller's own rules would break their build.
 */
export async function assertNextAdapterPreservesTurbopackConfig(): Promise<void> {
  const next = await loadNext();

  const preserved = next({
    turbopack: {
      resolveAlias: { "@": "./src" },
      rules: { "*.svg": { loaders: ["@svgr/webpack"] } },
    } as Record<string, unknown>,
  });
  assert.deepEqual(
    (preserved.turbopack as Record<string, unknown>).resolveAlias,
    { "@": "./src" },
    "unrelated Turbopack settings must survive",
  );
  assert.deepEqual(
    loadersOf(preserved.turbopack?.rules?.["*.svg"]),
    ["@svgr/webpack"],
    "an unrelated rule must survive untouched",
  );
  assert.ok(
    loadersOf(preserved.turbopack?.rules?.["*.ts"]).some(isTtscLoader),
    "and ttsc is still wired beside it",
  );

  // A caller who followed the README's manual instructions.
  const manual = next({
    turbopack: { rules: { "*.ts": { loaders: [LOADER] } } },
  });
  const manualLoaders = loadersOf(manual.turbopack?.rules?.["*.ts"]);
  assert.equal(
    manualLoaders.filter(isTtscLoader).length,
    1,
    "a hand-wired loader must not be registered a second time",
  );

  // A caller with another loader on the same glob keeps it, with ttsc first,
  // which is the ordering unplugin's `enforce: "pre"` gives the webpack half.
  const shared = next({
    turbopack: { rules: { "*.ts": { loaders: ["other-loader"] } } },
  });
  const sharedLoaders = loadersOf(shared.turbopack?.rules?.["*.ts"]);
  assert.equal(sharedLoaders.length, 2, "the caller's loader must survive");
  assert.ok(isTtscLoader(sharedLoaders[0]), "ttsc must run first");
  assert.equal(sharedLoaders[1], "other-loader");
}
