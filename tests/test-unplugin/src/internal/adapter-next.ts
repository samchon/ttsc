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

  // A caller with another loader on the same glob keeps it, with ttsc placed
  // where the chain runs it first. Turbopack runs rule loaders through
  // webpack's `loader-runner`, whose normal phase runs right to left, so the
  // last entry is the one that sees the original source, and ttsc has to be
  // that one because it transforms TypeScript into TypeScript.
  const shared = next({
    turbopack: { rules: { "*.ts": { loaders: ["other-loader"] } } },
  });
  const sharedLoaders = loadersOf(shared.turbopack?.rules?.["*.ts"]);
  assert.equal(sharedLoaders.length, 2, "the caller's loader must survive");
  assert.equal(sharedLoaders[0], "other-loader");
  assert.ok(
    isTtscLoader(sharedLoaders[1]),
    "ttsc must see the original source",
  );

  // Turbopack also accepts a bare array of loaders. Spreading that into an
  // object produced `{ "0": "other-loader", loaders: [...] }`, which Next's own
  // strict schema rejects as an unrecognized key.
  const arrayForm = next({
    turbopack: {
      rules: { "*.ts": ["other-loader"] } as Record<string, unknown>,
    },
  });
  const arrayRule = arrayForm.turbopack?.rules?.["*.ts"];
  assert.ok(
    !Object.keys(arrayRule as object).some((key) => /^\d+$/.test(key)),
    `an array rule must not be spread into an object (got ${JSON.stringify(arrayRule)})`,
  );
  const arrayLoaders = loadersOf(arrayRule);
  assert.equal(arrayLoaders.length, 2);
  assert.equal(arrayLoaders[0], "other-loader");
  assert.ok(isTtscLoader(arrayLoaders[1]));
}

/**
 * Asserts the wrapper does not register the loader a second time under a glob
 * the caller spelled differently.
 *
 * The dedupe guard read only the rule stored under the exact key the wrapper
 * writes, so a caller who had wired `"*.{ts,tsx}"` by hand, which is a natural
 * way to write two identical rules, kept their rule and received `"*.ts"` and
 * `"*.tsx"` as well. Every TypeScript module then matched two rules and the
 * loader ran twice on it, with the second pass receiving the first pass's
 * output (samchon/ttsc#1314).
 *
 * The wrapper still completes a partial hand wiring, since `"*.ts"` alone
 * leaves `.tsx` unrouted, and still adds its own rules beside a glob carrying
 * somebody else's loader, because that is not this loader running twice.
 */
export async function assertNextAdapterDoesNotDoubleRegisterAcrossGlobs(): Promise<void> {
  const next = await loadNext();
  const globs = (config: INextLikeConfig): string[] =>
    Object.keys(next(config).turbopack?.rules ?? {});

  assert.deepEqual(
    globs({ turbopack: { rules: { "*.{ts,tsx}": { loaders: [LOADER] } } } }),
    ["*.{ts,tsx}"],
    "a brace list already carrying the loader must not gain two more rules",
  );
  assert.deepEqual(
    globs({
      turbopack: {
        rules: {
          "**/*.ts": { loaders: [LOADER] },
          "**/*.tsx": { loaders: [LOADER] },
        },
      },
    }),
    ["**/*.ts", "**/*.tsx"],
    "a recursive prefix already carrying the loader must not gain two more",
  );

  // A partial hand wiring is still completed: `.tsx` is unrouted without us.
  assert.deepEqual(
    globs({ turbopack: { rules: { "*.ts": { loaders: [LOADER] } } } }),
    ["*.ts", "*.tsx"],
    "a partial hand wiring must still gain the glob it is missing",
  );

  // Somebody else's loader on the same file set is not this loader running
  // twice, so ttsc still has to be wired.
  assert.deepEqual(
    globs({ turbopack: { rules: { "*.{ts,tsx}": { loaders: ["other"] } } } }),
    ["*.{ts,tsx}", "*.ts", "*.tsx"],
    "another loader's glob must not suppress ttsc's own rules",
  );

  // The direction that matters most, because getting it wrong is
  // samchon/ttsc#1310 again rather than a double transform: a rule scoped to a
  // path covers its own subtree and says nothing about the rest of the
  // project, so the wrapper must still add its own.
  for (const scoped of [
    "src/*.{ts,tsx}",
    "src/**/*.ts",
    "./src/**/*.{ts,tsx}",
    "generated.ts",
    "*.d.ts",
  ]) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [scoped]: { loaders: [LOADER] } } } }),
      [scoped, "*.ts", "*.tsx"],
      `a rule scoped by ${scoped} must not suppress the project-wide rules`,
    );
  }

  // And the shape the guard does recognise, under a recursive prefix.
  assert.deepEqual(
    globs({ turbopack: { rules: { "**/*.{ts,tsx}": { loaders: [LOADER] } } } }),
    ["**/*.{ts,tsx}"],
    "a project-wide brace list under a recursive prefix already covers both",
  );
}

/**
 * Asserts the wrapper says what Next.js can no longer say for it.
 *
 * Next refuses to build on Turbopack when a config carries a `webpack` hook and
 * no `turbopack` block, because the hook is then silently ignored. This wrapper
 * always defines both, so that check can never fire again for anyone who uses
 * it. Wiring Turbopack is worth one warning, not the loss of the warning Next
 * already gave (samchon/ttsc#1310).
 */
export async function assertNextAdapterWarnsAboutASuppressedWebpackHook(): Promise<void> {
  const next = await loadNext();
  const capture = (config: INextLikeConfig): string => {
    const original = process.stderr.write.bind(process.stderr);
    let written = "";
    process.stderr.write = ((chunk: unknown) => {
      written += String(chunk);
      return true;
    }) as typeof process.stderr.write;
    try {
      next(config);
    } finally {
      process.stderr.write = original;
    }
    return written;
  };

  const warned = capture({ webpack: (config) => config });
  assert.match(
    warned,
    /withTtsc now configures Turbopack/,
    "a caller's own webpack hook must not be dropped in silence",
  );

  assert.equal(
    capture({}),
    "",
    "a caller with no webpack hook has nothing to lose",
  );
  assert.equal(
    capture({ turbopack: { rules: {} }, webpack: (config) => config }),
    "",
    "a caller who already configured Turbopack has made the decision",
  );
}
