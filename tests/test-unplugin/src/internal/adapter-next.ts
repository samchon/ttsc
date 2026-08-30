import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const LOADER = "@ttsc/unplugin/turbopack";

/**
 * Every glob this suite proves the dedupe guard recognises as naming the whole
 * project, for both extensions.
 *
 * Cross-checked against the list the experimental suite drives through real
 * Turbopack builds, so neither can gain a spelling the other has not seen.
 */
const RECOGNISED_PROJECT_WIDE_GLOBS = [
  "*.ts",
  "**/*.ts",
  "*.{ts,tsx}",
  "{*.ts,*.tsx}",
  "**/*.{ts,tsx}",
  "**/{*.ts,*.tsx}",
  "{**/,}*.ts",
  "**/**/*.{ts,tsx}",
];

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
  // Both spellings of it, since samchon/ttsc#1314 asks for the recursive one by
  // name and a guard could recognise `*.ts` while missing `**` + `/*.ts`.
  for (const partial of ["*.ts", "**/*.ts"]) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [partial]: { loaders: [LOADER] } } } }),
      [partial, "*.tsx"],
      `${partial} must still gain the glob it is missing`,
    );
  }

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

  // And the shapes the guard does recognise. Each names every file with the
  // extension, so the wrapper's own rules would be a second registration of a
  // file set the caller already routed. Every one of these is driven through a
  // real Turbopack build by `experimental/test-unplugin`, because whether a
  // glob covers the project is Turbopack's answer and not ours.
  for (const wide of [
    "*.{ts,tsx}",
    "{*.ts,*.tsx}",
    "**/*.{ts,tsx}",
    "**/{*.ts,*.tsx}",
    "**/**/*.{ts,tsx}",
  ]) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [wide]: { loaders: [LOADER] } } } }),
      [wide],
      `${wide} names every file of both extensions, so nothing is added`,
    );
  }

  // Recognition is per extension, not per rule: a glob naming every `.ts` and
  // no `.tsx` suppresses only the `*.ts` registration, exactly as the partial
  // hand wiring above does.
  for (const partial of ["{**/,}*.ts", "**/*.ts"]) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [partial]: { loaders: [LOADER] } } } }),
      [partial, "*.tsx"],
      `${partial} names every .ts, so only the missing .tsx is added`,
    );
  }

  // A path segment anywhere disqualifies the whole glob, including inside a
  // brace group. Set semantics say `{src/,}*.ts` offers a bare `*.ts` and so
  // must cover everything; Turbopack, measured, matches **nothing** with it —
  // not even `src/`. Recognising it suppressed this wrapper's rules in favour
  // of a rule that transforms no file at all, which is samchon/ttsc#1310 caused
  // by the guard meant to prevent it (samchon/ttsc#1319). Every alternative has
  // to be unscoped, not merely one of them.
  for (const scopedGroup of [
    "{src/,}*.ts",
    "{src,lib}/*.{ts,tsx}",
    "{src/,lib/}*.ts",
  ]) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [scopedGroup]: { loaders: [LOADER] } } } }),
      [scopedGroup, "*.ts", "*.tsx"],
      `${scopedGroup} carries a path segment, so it must not suppress anything`,
    );
  }

  await assertRecognisedGlobsMatchTheRealBuildList(globs);
}

/**
 * Assert the guard and the experimental suite name the same recognised set.
 *
 * Whether a glob covers the project is Turbopack's answer, so the recognised
 * set is only ever as good as the real builds that check it. Those builds live
 * in `experimental/test-unplugin`, in a list this fast suite cannot import —
 * that harness runs against installed tarballs, not this source tree. The two
 * lists were therefore synchronised by convention, and a convention is what
 * lost `{src/,}*.ts`: the guard recognised a spelling no build ever drove, and
 * it turned out to match nothing at all (samchon/ttsc#1319).
 *
 * So the invariant is asserted in both directions instead of trusted. Adding a
 * spelling to the guard without adding it to the harness fails here, and so
 * does the reverse.
 */
async function assertRecognisedGlobsMatchTheRealBuildList(
  globs: (config: INextLikeConfig) => string[],
): Promise<void> {
  const harness = await readFile(
    new URL(
      "../../../../experimental/test-unplugin/src/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const declared = /const TURBOPACK_PROJECT_WIDE_GLOBS = \[([^\]]*)\]/.exec(
    harness,
  );
  const body = declared?.[1];
  assert.ok(body, "the experimental suite must declare its recognised set");
  const listed = [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(
    (match) => JSON.parse(`"${match[1]}"`) as string,
  );
  assert.ok(listed.length > 0, "that list must not be empty");

  // Every glob the real builds drive must actually be recognised, or those
  // builds are proving something about a spelling the guard never takes.
  // Recognition means at least one of the wrapper's two rules is declined; a
  // glob naming one extension, `*.ts`, still leaves the other to be added.
  for (const glob of listed) {
    const wired = globs({
      turbopack: { rules: { [glob]: { loaders: [LOADER] } } },
    });
    assert.ok(
      wired.length < 3,
      `${glob} is driven through a real build, so the guard must recognise it (got ${JSON.stringify(wired)})`,
    );
  }

  // And every spelling this suite proves recognised must be driven there.
  for (const glob of RECOGNISED_PROJECT_WIDE_GLOBS) {
    assert.ok(
      listed.includes(glob),
      `${glob} is recognised here, so a real Turbopack build must drive it`,
    );
  }
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
  // What this wrapper suppresses is a refusal, not a warning. Next 16.3.2's
  // `turbopack-warning.js` logs an error and calls `process.exit(1)` when the
  // bundler was defaulted, a `webpack` hook exists, and no `turbopack` block
  // does — and `hasTurboConfig` is read from this wrapper's own return value.
  // Saying "warn" understates what the caller loses (samchon/ttsc#1320).
  assert.match(
    warned,
    /stop the build/,
    "the message must say the build would have been stopped, not merely warned about",
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
  assert.equal(
    capture({ turbopack: { rules: {} } }),
    "",
    "a caller who configured only Turbopack has no webpack hook to lose",
  );
}
