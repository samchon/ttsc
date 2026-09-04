import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LOADER = "@ttsc/unplugin/turbopack";
const LOADER_IDENTITIES = [
  LOADER,
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN.resolve(LOADER),
  TestUnpluginRuntime.libPath("turbopack", "mjs"),
];
const LOADER_FORMS = LOADER_IDENTITIES.flatMap((loader) => [
  loader,
  { loader, options: { configured: true } },
]);
const AUTOMATIC_RULE_GLOBS = ["*.ts", "*.tsx", "*.mts", "*.cts"];
const EXTENSION_NAMES = AUTOMATIC_RULE_GLOBS.map((glob) => glob.slice(2));
const REQUIRED_EXTENSION_GROUPS = [
  ["ts", "tsx"],
  ["ts", "mts"],
  ["ts", "cts"],
  ["tsx", "mts"],
  ["tsx", "cts"],
  ["mts", "cts"],
  ["ts", "tsx", "mts"],
  ["ts", "tsx", "cts"],
  ["ts", "mts", "cts"],
  ["tsx", "mts", "cts"],
  ["ts", "tsx", "mts", "cts"],
] as const;

/**
 * Spellings the exact guard must refuse because no real build measured them.
 *
 * `{src/,}*.ts` is the measured one: Turbopack matches nothing with it, so
 * recognising it left every module without a rule (samchon/ttsc#1319). The rest
 * include whitespace around otherwise measured keys, which cannot be assumed
 * equivalent unless Turbopack itself proves that normalization. The other
 * shapes are unmeasured, which is the same reason — nothing has shown that
 * Turbopack expands a single-alternative group, a leading empty alternative, or
 * two groups in one glob, so claiming they cover the project would be a guess
 * in the direction that fails silently.
 */
const REFUSED_GLOBS = [
  " *.ts",
  "*.ts ",
  "{src/,}*.ts",
  "{src,lib}/*.{ts,tsx}",
  "{src/,lib/}*.ts",
  "*.{ts}",
  "{,**/}*.ts",
  "{**/,}*.{ts,tsx}",
  "*.{ts,}",
];

interface INextLikeConfig {
  turbopack?: { rules?: Record<string, unknown> };
  webpack?: (config: { plugins?: unknown[] }, options: unknown) => unknown;
  [key: string]: unknown;
}

interface INextModule {
  default: (config?: INextLikeConfig, options?: unknown) => INextLikeConfig;
  TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE: ReadonlyArray<
    readonly [string, readonly string[]]
  >;
}

/** Load the complete built `next` module, including its measured allowlist. */
async function loadNextModule(): Promise<INextModule> {
  return (await import(TestUnpluginRuntime.libUrl("next"))) as INextModule;
}

/** Load the built `next` adapter entry. */
async function loadNext(): Promise<
  (config?: INextLikeConfig, options?: unknown) => INextLikeConfig
> {
  return (await loadNextModule()).default;
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
  const identity =
    typeof entry === "string"
      ? entry
      : typeof entry === "object" && entry !== null
        ? (entry as { loader?: unknown }).loader
        : undefined;
  return typeof identity === "string" && LOADER_IDENTITIES.includes(identity);
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
  for (const glob of AUTOMATIC_RULE_GLOBS) {
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

  // A caller who followed the README's manual instructions gets the exact same
  // four-rule set as the wrapper and none of them is registered twice.
  const manual = next({
    turbopack: {
      rules: Object.fromEntries(
        AUTOMATIC_RULE_GLOBS.map((glob) => [glob, { loaders: [LOADER] }]),
      ),
    },
  });
  assert.deepEqual(
    Object.keys(manual.turbopack?.rules ?? {}),
    AUTOMATIC_RULE_GLOBS,
  );
  for (const glob of AUTOMATIC_RULE_GLOBS) {
    assert.equal(
      loadersOf(manual.turbopack?.rules?.[glob]).filter(isTtscLoader).length,
      1,
      `${glob} must not be registered a second time`,
    );
  }

  // A caller with another loader on the same glob keeps it, with ttsc placed
  // where the chain runs it first. Turbopack runs rule loaders through
  // webpack's `loader-runner`, whose normal phase runs right to left, so the
  // last entry is the one that sees the original source, and ttsc has to be
  // that one because it transforms TypeScript into TypeScript.
  const sharedRule = {
    as: "*.js",
    futureSetting: { retained: true },
    loaders: ["other-loader"],
    type: "typescript",
  };
  const shared = next({
    turbopack: { rules: { "*.ts": sharedRule } },
  });
  const sharedRuleOutput = shared.turbopack?.rules?.["*.ts"] as Record<
    string,
    unknown
  >;
  const sharedLoaders = loadersOf(sharedRuleOutput);
  assert.equal(sharedLoaders.length, 2, "the caller's loader must survive");
  assert.equal(sharedLoaders[0], "other-loader");
  assert.ok(
    isTtscLoader(sharedLoaders[1]),
    "ttsc must see the original source",
  );
  assert.equal(sharedRuleOutput.as, sharedRule.as);
  assert.equal(sharedRuleOutput.type, sharedRule.type);
  assert.deepEqual(sharedRuleOutput.futureSetting, sharedRule.futureSetting);

  const noLoadersRule = {
    as: "*.js",
    futureSetting: { retained: true },
    type: "typescript",
  };
  const noLoaders = next({
    turbopack: { rules: { "*.ts": noLoadersRule } },
  }).turbopack?.rules?.["*.ts"] as Record<string, unknown>;
  assert.ok(!Array.isArray(noLoaders));
  assert.equal(noLoaders.as, noLoadersRule.as);
  assert.equal(noLoaders.type, noLoadersRule.type);
  assert.deepEqual(noLoaders.futureSetting, noLoadersRule.futureSetting);
  assert.equal(loadersOf(noLoaders).filter(isTtscLoader).length, 1);

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
    Array.isArray(arrayRule),
    `an array rule must remain an array (got ${JSON.stringify(arrayRule)})`,
  );
  const arrayLoaders = loadersOf(arrayRule);
  assert.equal(arrayLoaders.length, 2);
  assert.equal(arrayLoaders[0], "other-loader");
  assert.ok(isTtscLoader(arrayLoaders[1]));

  const emptyCollection = next({
    turbopack: { rules: { "*.ts": [] } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(emptyCollection));
  assert.equal(emptyCollection.length, 1);
  assert.ok(isTtscLoader(emptyCollection[0]));

  const conditionalRule = {
    as: "*.js",
    condition: "browser",
    futureSetting: { retained: true },
    type: "typescript",
  };
  const conditional = next({
    turbopack: { rules: { "*.ts": conditionalRule } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(conditional));
  assert.ok(loadersOf(conditional[0]).some(isTtscLoader));
  assert.deepEqual(conditional[1], conditionalRule);

  const mixedInput = [
    "other-loader",
    { condition: "browser", loaders: ["browser-loader"] },
    { condition: "node", futureSetting: true, type: "typescript" },
  ];
  const mixed = next({
    turbopack: { rules: { "*.ts": mixedInput } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(mixed));
  assert.ok(loadersOf(mixed[0]).some(isTtscLoader));
  assert.deepEqual(mixed.slice(1), mixedInput);

  for (const loader of LOADER_FORMS) {
    const resolved = next({
      turbopack: { rules: { "*.ts": [loader] } },
    }).turbopack?.rules?.["*.ts"];
    assert.ok(Array.isArray(resolved));
    assert.equal(
      resolved.length,
      1,
      `${JSON.stringify(loader)} must not be registered a second time`,
    );
    assert.deepEqual(resolved[0], loader);
  }

  const conditionalLoader = {
    condition: "browser",
    loaders: [LOADER],
  };
  const conditionallyCovered = next({
    turbopack: { rules: { "*.ts": conditionalLoader } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(conditionallyCovered));
  assert.ok(loadersOf(conditionallyCovered[0]).some(isTtscLoader));
  assert.deepEqual(conditionallyCovered[1], conditionalLoader);

  const unrelated = path.join(
    path.dirname(LOADER_IDENTITIES[1]!),
    "..",
    "..",
    "ttsc",
    "lib",
    "turbopack.js",
  );
  const unrelatedRule = next({
    turbopack: { rules: { "*.ts": [unrelated] } },
  }).turbopack?.rules?.["*.ts"];
  assert.ok(Array.isArray(unrelatedRule));
  assert.equal(unrelatedRule[0], unrelated);
  assert.ok(isTtscLoader(unrelatedRule[1]));

  // An absolute loader's package ownership is a filesystem observation, not a
  // permanent property of its lexical path. Reusing the wrapper in one process
  // must see both directions of an atomic install or link retarget.
  const positiveRoot = TestProject.tmpdir("ttsc-next-loader-positive-");
  const positiveLoader = path.join(positiveRoot, "lib", "turbopack.js");
  const positiveLoaderUrl = pathToFileURL(positiveLoader).href;
  fs.mkdirSync(path.dirname(positiveLoader), { recursive: true });
  fs.writeFileSync(positiveLoader, "", "utf8");
  fs.writeFileSync(
    path.join(positiveRoot, "package.json"),
    JSON.stringify({ name: "@ttsc/unplugin" }),
    "utf8",
  );
  const initiallyOwned = loadersOf(
    next({
      turbopack: { rules: { "*.ts": [positiveLoaderUrl] } },
    }).turbopack?.rules?.["*.ts"],
  );
  assert.deepEqual(initiallyOwned, [positiveLoaderUrl]);
  fs.writeFileSync(
    path.join(positiveRoot, "package.json"),
    JSON.stringify({ name: "unrelated-loader" }),
    "utf8",
  );
  const replacedOwner = loadersOf(
    next({
      turbopack: { rules: { "*.ts": [positiveLoaderUrl] } },
    }).turbopack?.rules?.["*.ts"],
  );
  assert.equal(replacedOwner[0], positiveLoaderUrl);
  assert.ok(
    isTtscLoader(replacedOwner[1]),
    "a stale positive ownership verdict must not suppress the ttsc loader",
  );

  const negativeStore = TestProject.tmpdir("ttsc-next-loader-negative-");
  const foreignRoot = path.join(negativeStore, "foreign");
  const ownedRoot = path.join(negativeStore, "owned");
  const linkedRoot = path.join(negativeStore, "current");
  for (const root of [foreignRoot, ownedRoot]) {
    const loader = path.join(root, "lib", "turbopack.js");
    fs.mkdirSync(path.dirname(loader), { recursive: true });
    fs.writeFileSync(loader, "", "utf8");
  }
  fs.writeFileSync(
    path.join(foreignRoot, "package.json"),
    JSON.stringify({ name: "unrelated-loader" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(ownedRoot, "package.json"),
    JSON.stringify({ name: "@ttsc/unplugin" }),
    "utf8",
  );
  fs.symlinkSync(
    foreignRoot,
    linkedRoot,
    process.platform === "win32" ? "junction" : "dir",
  );
  const negativeLoader = path.join(linkedRoot, "lib", "turbopack.js");
  const initiallyForeign = loadersOf(
    next({
      turbopack: { rules: { "*.ts": [negativeLoader] } },
    }).turbopack?.rules?.["*.ts"],
  );
  assert.equal(initiallyForeign[0], negativeLoader);
  assert.ok(isTtscLoader(initiallyForeign[1]));
  fs.rmSync(linkedRoot, { force: true, recursive: true });
  fs.symlinkSync(
    ownedRoot,
    linkedRoot,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.deepEqual(
    loadersOf(
      next({
        turbopack: { rules: { "*.ts": [negativeLoader] } },
      }).turbopack?.rules?.["*.ts"],
    ),
    [negativeLoader],
    "a stale negative ownership verdict must not duplicate the ttsc loader",
  );

  // Loader ownership follows the filesystem's identity and file-kind answers,
  // not the caller's lexical casing. A case-insensitive volume must collapse a
  // differently cased spelling, while a case-sensitive volume must retain it
  // as a missing foreign loader and append ttsc's real loader.
  const identityRoot = TestProject.tmpdir("ttsc-next-loader-identity-");
  fs.mkdirSync(path.join(identityRoot, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(identityRoot, "package.json"),
    JSON.stringify({ name: "@ttsc/unplugin" }),
    "utf8",
  );
  for (const extension of ["js", "mjs"]) {
    const identityLoader = path.join(
      identityRoot,
      "lib",
      `turbopack.${extension}`,
    );
    fs.writeFileSync(identityLoader, "", "utf8");
    const caseVariant = path.join(
      identityRoot,
      "LIB",
      `TURBOPACK.${extension.toUpperCase()}`,
    );
    const caseVariantLoaders = loadersOf(
      next({
        turbopack: { rules: { "*.ts": [caseVariant] } },
      }).turbopack?.rules?.["*.ts"],
    );
    if (fs.existsSync(caseVariant)) {
      assert.deepEqual(
        caseVariantLoaders,
        [caseVariant],
        `a case-insensitive filesystem identity must suppress the duplicate ${extension} loader`,
      );
    } else {
      assert.equal(caseVariantLoaders[0], caseVariant);
      assert.ok(
        isTtscLoader(caseVariantLoaders[1]),
        `a case-sensitive filesystem must not fold a missing ${extension} case variant`,
      );
    }

    const upperSchemeUrl = pathToFileURL(identityLoader).href.replace(
      /^file:/,
      "FILE:",
    );
    assert.deepEqual(
      loadersOf(
        next({
          turbopack: { rules: { "*.ts": [upperSchemeUrl] } },
        }).turbopack?.rules?.["*.ts"],
      ),
      [upperSchemeUrl],
      `the case-insensitive file URL scheme must preserve ${extension} loader ownership`,
    );
  }

  // A package manifest cannot own a loader path that does not name a regular
  // file. Both controls would be false positives if ownership were inferred
  // only from the lexical `lib/turbopack.js` suffix and neighboring manifest.
  for (const kind of ["missing", "directory"] as const) {
    const invalidRoot = TestProject.tmpdir(`ttsc-next-loader-${kind}-`);
    const invalidLoader = path.join(invalidRoot, "lib", "turbopack.js");
    fs.mkdirSync(path.dirname(invalidLoader), { recursive: true });
    if (kind === "directory") {
      fs.mkdirSync(invalidLoader);
    }
    fs.writeFileSync(
      path.join(invalidRoot, "package.json"),
      JSON.stringify({ name: "@ttsc/unplugin" }),
      "utf8",
    );
    const invalidLoaders = loadersOf(
      next({
        turbopack: { rules: { "*.ts": [invalidLoader] } },
      }).turbopack?.rules?.["*.ts"],
    );
    assert.equal(invalidLoaders[0], invalidLoader);
    assert.ok(
      isTtscLoader(invalidLoaders[1]),
      `an owned package's ${kind} loader path must not suppress the real loader`,
    );
  }
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
  const nextModule = await loadNextModule();
  const next = nextModule.default;
  const coverageEntries = nextModule.TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE;
  const coverage = new Map(coverageEntries);
  assert.ok(
    coverageEntries.length > 0,
    "the measured allowlist must not be empty",
  );
  assert.equal(
    coverage.size,
    coverageEntries.length,
    "the measured allowlist must not contain duplicate glob spellings",
  );
  for (const extension of EXTENSION_NAMES) {
    for (const glob of [
      `*.${extension}`,
      `**/*.${extension}`,
      `{**/,}*.${extension}`,
    ]) {
      assert.deepEqual(
        coverage.get(glob),
        [extension],
        `${glob} must cover its complete single-extension family`,
      );
    }
  }
  for (const extensions of REQUIRED_EXTENSION_GROUPS) {
    const suffixes = extensions.join(",");
    const alternatives = extensions
      .map((extension) => `*.${extension}`)
      .join(",");
    for (const glob of [
      `*.{${suffixes}}`,
      `{${alternatives}}`,
      `**/*.{${suffixes}}`,
      `**/{${alternatives}}`,
      `**/**/*.{${suffixes}}`,
    ]) {
      assert.deepEqual(
        coverage.get(glob),
        extensions,
        `${glob} must cover its complete extension combination`,
      );
    }
  }
  const globs = (config: INextLikeConfig): string[] =>
    Object.keys(next(config).turbopack?.rules ?? {});

  assert.deepEqual(
    globs({ turbopack: { rules: { "*.{ts,tsx}": { loaders: [LOADER] } } } }),
    ["*.{ts,tsx}", "*.mts", "*.cts"],
    "a brace list must suppress only the two extensions it actually names",
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
    ["**/*.ts", "**/*.tsx", "*.mts", "*.cts"],
    "recursive rules must leave only the missing module-format extensions",
  );

  // A partial hand wiring is still completed: three extensions are unrouted.
  // Both spellings of it, since samchon/ttsc#1314 asks for the recursive one by
  // name and a guard could recognise `*.ts` while missing `**` + `/*.ts`.
  for (const partial of ["*.ts", "**/*.ts"]) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [partial]: { loaders: [LOADER] } } } }),
      [partial, "*.tsx", "*.mts", "*.cts"],
      `${partial} must still gain every glob it is missing`,
    );
  }

  // Somebody else's loader on the same file set is not this loader running
  // twice, so ttsc still has to be wired.
  assert.deepEqual(
    globs({ turbopack: { rules: { "*.{ts,tsx}": { loaders: ["other"] } } } }),
    ["*.{ts,tsx}", ...AUTOMATIC_RULE_GLOBS],
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
      [scoped, ...AUTOMATIC_RULE_GLOBS],
      `a rule scoped by ${scoped} must not suppress the project-wide rules`,
    );
  }

  // And the shapes the guard does recognise. Each names every file with the
  // extension, so the wrapper's own rules would be a second registration of a
  // file set the caller already routed. Every one of these is driven through a
  // real Turbopack build by `experimental/test-unplugin`, because whether a
  // glob covers the project is Turbopack's answer and not ours.
  for (const [wide, covered] of coverageEntries) {
    const missing = AUTOMATIC_RULE_GLOBS.filter(
      (glob) => !covered.includes(glob.slice(2)),
    );
    for (const loader of LOADER_FORMS) {
      assert.deepEqual(
        globs({ turbopack: { rules: { [wide]: { loaders: [loader] } } } }),
        [wide, ...missing],
        `${wide} with ${JSON.stringify(loader)} must suppress exactly ${covered.join(", ")}`,
      );
    }
  }

  assert.deepEqual(
    globs({
      turbopack: {
        rules: {
          "*.{ts,tsx}": { condition: "browser", loaders: [LOADER] },
        },
      },
    }),
    ["*.{ts,tsx}", ...AUTOMATIC_RULE_GLOBS],
    "conditional coverage under an alternate glob must suppress nothing",
  );

  // Everything the guard does not recognise keeps all wrapper rules.
  // `{src/,}*.ts` is why recognition is an exact set and not a predicate: set
  // semantics say its bare `*.ts` alternative covers the project, and Turbopack
  // matches nothing with it, so recognising it left every module with no rule
  // at all — samchon/ttsc#1310 caused by the guard meant to prevent it. The
  // unmeasured brace shapes beside it would have been accepted by that same
  // predicate on the same kind of reasoning (samchon/ttsc#1319).
  for (const refused of REFUSED_GLOBS) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [refused]: { loaders: [LOADER] } } } }),
      [refused, ...AUTOMATIC_RULE_GLOBS],
      `${refused} is not a measured project-wide spelling, so it must suppress nothing`,
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
