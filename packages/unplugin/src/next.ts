import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TtscUnpluginOptions } from "./core/options";
import {
  TYPESCRIPT_TRANSFORM_EXTENSIONS,
  TYPESCRIPT_TURBOPACK_RULE_GLOBS,
} from "./core/sourceExtensions";
import webpack from "./webpack";

/** The standalone loader entry Turbopack accepts through `turbopack.rules`. */
const TURBOPACK_LOADER = "@ttsc/unplugin/turbopack";
/**
 * The globs the loader is wired for.
 *
 * The same exact set the manual wiring in the README uses. A wider glob would
 * be harmless, since `isTransformTarget` declines everything else that reaches
 * the loader, but it would also route files through a worker for nothing.
 */
const TURBOPACK_RULE_GLOBS = TYPESCRIPT_TURBOPACK_RULE_GLOBS;

/**
 * Minimal structural type for a Next.js configuration object.
 *
 * Only `webpack` and `turbopack` are used by this adapter; all other Next.js
 * options are forwarded as-is through the spread operator.
 */
export type NextLikeConfig = Record<string, unknown> & {
  /**
   * Optional existing webpack customisation hook. When the caller has already
   * defined one, `next()` will chain through to it after injecting the ttsc
   * webpack plugin.
   */
  webpack?: (config: WebpackLikeConfig, options: unknown) => WebpackLikeConfig;
  /**
   * Optional existing Turbopack configuration. Preserved whole; only the ttsc
   * rules are merged into its `rules` map.
   */
  turbopack?: TurbopackLikeConfig;
};

/**
 * Minimal structural type for a webpack configuration object as seen by the
 * Next.js `webpack` hook callback.
 */
export type WebpackLikeConfig = Record<string, unknown> & {
  /** The webpack plugin array; initialised to `[]` by this adapter if absent. */
  plugins?: unknown[];
};

/** Minimal structural type for Next.js's `turbopack` configuration block. */
export type TurbopackLikeConfig = Record<string, unknown> & {
  /** Per-glob loader rules. Other Turbopack settings are preserved untouched. */
  rules?: Record<string, unknown>;
};

/**
 * Wrap a Next.js config object so that ttsc runs under whichever bundler
 * Next.js uses.
 *
 * The webpack plugin is injected through the `webpack` hook, and the Turbopack
 * loader is wired through `turbopack.rules`, with the same options reaching
 * both. Covering only webpack meant that a project on Turbopack, which is the
 * default bundler in current Next majors, silently got no transform at all: the
 * build succeeded and every plugin-driven construct in it, a typia
 * `assert<T>()` above all, survived untransformed into a runtime failure
 * (samchon/ttsc#1310).
 *
 * Both halves are additive. An existing `webpack` hook is preserved and called
 * after the plugin is injected, and an existing `turbopack` block keeps every
 * setting and every rule it already had.
 *
 * @param nextConfig - The caller's existing Next.js config (spread into the
 *   returned object unchanged, except for `webpack` and `turbopack`).
 * @param options - Ttsc plugin options forwarded to both bundlers.
 */
export default function next(
  nextConfig: NextLikeConfig = {},
  options?: TtscUnpluginOptions,
): NextLikeConfig {
  warnAboutSuppressedWebpackConfig(nextConfig);
  return {
    ...nextConfig,
    turbopack: withTtscTurbopackRules(nextConfig.turbopack, options),
    webpack(config: WebpackLikeConfig, webpackOptions: unknown) {
      config.plugins = Array.isArray(config.plugins) ? config.plugins : [];
      // Prepend so ttsc runs before any user-added plugins.
      config.plugins.unshift(webpack(options));
      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, webpackOptions);
      }
      return config;
    },
  };
}

/**
 * Say what Next.js can no longer say once this wrapper defines `turbopack`.
 *
 * Next stops the build when a config carries a `webpack` hook and no
 * `turbopack` block, because the webpack hook is then silently ignored. Read
 * from Next 16.3.2's own `dist/lib/turbopack-warning.js`, it is
 * `log.error(...)` followed by `process.exit(1)` — a refusal, not a warning —
 * and it is gated on `process.env.TURBOPACK === "auto"`, which
 * `dist/lib/bundler.js` sets only when no bundler flag was passed. Next's
 * comment there gives the reason: an explicit `--turbopack` means the user
 * chose it and is assumed to have configured it. So the check fires on a plain
 * `next build` or `next dev`, which is how Next 16 is normally run.
 *
 * `hasTurboConfig` is read from the raw exported config, which is this
 * wrapper's return value, and this wrapper always defines `turbopack`. The
 * check therefore can never fire again for anyone who uses `withTtsc`, and a
 * caller's own webpack customisation would be dropped on a Turbopack build with
 * nothing said. Wiring ttsc for Turbopack is worth exactly one line, not the
 * loss of the refusal Next already gave.
 *
 * Verifying that gate is what this docstring exists for: measured with an
 * explicit `--turbopack`, the check is silent, and a reading that stopped there
 * would conclude Next says nothing and delete a true statement.
 *
 * Only for a caller who wrote a `webpack` hook and no `turbopack` block. A
 * caller who configured Turbopack has already made that decision, and a caller
 * with neither has no webpack-only configuration to lose.
 */
function warnAboutSuppressedWebpackConfig(nextConfig: NextLikeConfig): void {
  if (
    typeof nextConfig.webpack !== "function" ||
    nextConfig.turbopack !== undefined
  ) {
    return;
  }
  process.stderr.write(
    "@ttsc/unplugin: withTtsc now configures Turbopack as well as webpack, so " +
      "Next.js will no longer stop the build to tell you that your own " +
      "`webpack` hook is ignored on a Turbopack build. Port it to `turbopack`, " +
      "or run the bundler you configured with `next build --webpack` / " +
      "`next dev --webpack`." +
      String.fromCharCode(10),
  );
}

/**
 * Merge the ttsc loader rules into a caller's Turbopack configuration.
 *
 * Additive in every direction: unrelated Turbopack settings and unrelated rules
 * are carried through untouched, and a glob the caller already configured keeps
 * its own loaders with ttsc placed where the chain runs it first. A caller who
 * already wired this loader by hand is left exactly as they are, so following
 * the README's manual instructions and then adopting the wrapper cannot
 * register it twice.
 */
function withTtscTurbopackRules(
  existing: TurbopackLikeConfig | undefined,
  options?: TtscUnpluginOptions,
): TurbopackLikeConfig {
  const rules: Record<string, unknown> = { ...(existing?.rules ?? {}) };
  // Package ownership is stable only for this configuration snapshot. A later
  // call may observe an atomic install or a directory-link retarget at the same
  // lexical loader path, so no verdict can escape this invocation.
  const resolvedLoaderResults = new Map<string, boolean>();
  for (const glob of TURBOPACK_RULE_GLOBS) {
    const rule = rules[glob];
    if (hasUnconditionalTtscLoader(rule, resolvedLoaderResults)) {
      continue;
    }
    // The caller may have written the same file set under a different glob.
    // Adding ours beside theirs makes every matching module run the loader
    // twice, and the second pass receives the first pass's output, so the
    // guard has to cover the spellings a caller plausibly uses rather than
    // only the four this wrapper writes (samchon/ttsc#1314).
    if (coveredByAnotherRule(rules, glob, resolvedLoaderResults)) {
      continue;
    }
    const entry = { loader: TURBOPACK_LOADER, options: options ?? {} };
    // Loader shorthand runs right to left, so ttsc is appended there to see
    // the original source. Rule collections run matching items in order, so
    // ttsc becomes an explicit first rule there for the same reason. That is
    // the same position `enforce: "pre"` gives it on the webpack half.
    //
    // Measured rather than inferred from webpack's `loader-runner`: two
    // loaders on one rule, each marking the source, came back marked in the
    // order that only the last-runs-first chain produces (samchon/ttsc#1319).
    rules[glob] = addUnconditionalTtscLoader(rule, entry);
  }
  return { ...(existing ?? {}), rules };
}

/**
 * Whether some other rule already routes this glob's files through the loader.
 *
 * Deciding glob equivalence in general means implementing Turbopack's matcher,
 * which is not worth it here. What is recognised instead is the spellings a
 * caller plausibly writes for "every file with this extension", since only a
 * glob that means every file can make the wrapper's own rules redundant. That
 * is narrower than every glob with those semantics, and narrow on purpose:
 * anything unrecognised is left alone and the wrapper still adds its rules,
 * while skipping on a scoped glob would leave every module outside that scope
 * untransformed, which is samchon/ttsc#1310 again and the quieter of the two
 * failures. {@link matchesExtension} owns the rule and names what it declines.
 */
function coveredByAnotherRule(
  rules: Record<string, unknown>,
  glob: string,
  resolvedLoaderResults: Map<string, boolean>,
): boolean {
  const extension = glob.slice(glob.lastIndexOf(".") + 1);
  return Object.entries(rules).some(([candidate, rule]) => {
    if (candidate === glob) {
      return false;
    }
    if (!hasUnconditionalTtscLoader(rule, resolvedLoaderResults)) {
      return false;
    }
    return matchesExtension(candidate, extension);
  });
}

/**
 * Whether one glob names this extension across the whole project.
 *
 * Unscoped only. A rule carrying a path segment says nothing about the rest of
 * the project, so treating it as covering everything would leave every module
 * outside it with no ttsc rule at all. That is the silent failure
 * samchon/ttsc#1310 is about, and it is strictly worse than the double
 * registration this guard exists to prevent: a module no loader ever sees fails
 * at runtime, while a module transformed twice costs time.
 *
 * How little a scoped rule covers is worth stating from measurement rather than
 * from the obvious guess, because the guess is wrong. Against Next.js 16.3.2,
 * `src/*.ts` and `src/**` + `/*.ts` match **nothing at all** — not even the
 * `src/` subtree they name — while `./src/*.ts`, `**` + `/src/*.ts` and a bare
 * `nested-probe.ts` all match a file at `src/`. Declining every one of them is
 * therefore even safer than "it only covers its subtree" implies
 * (samchon/ttsc#1319).
 *
 * The answer comes from {@link PROJECT_WIDE_GLOBS}, an exact set of measured
 * spellings, and that document explains why it is a set rather than a rule.
 */
function matchesExtension(glob: string, extension: string): boolean {
  return PROJECT_WIDE_GLOBS.get(glob)?.includes(extension) === true;
}

/**
 * The exact glob spellings a real Turbopack build has shown to name every file
 * with an extension, and which extensions each one covers.
 *
 * An allowlist rather than a predicate, because recognising a glob is a claim
 * about Turbopack's matcher and every claim here has to be one somebody
 * measured. A rule inferred from glob semantics kept being wrong in the silent
 * direction: `{src/,}*.ts` contains a bare `*.ts` alternative and so must cover
 * the project by any set-theoretic reading, yet Turbopack matches nothing with
 * it, and recognising it suppressed this wrapper's rules in favour of a rule
 * that transforms no file at all — samchon/ttsc#1310 caused by the guard meant
 * to prevent it (samchon/ttsc#1319).
 *
 * The deeper problem was that a predicate is open-ended: it answers for every
 * spelling anyone might write, including ones no build has ever driven.
 * `*.{ts}` and `{,**` + `/}*.ts` were both accepted on that reasoning while
 * nothing had checked whether Turbopack expands a single-alternative group or a
 * leading empty one. An exact set cannot overreach, so an unmeasured spelling
 * is simply not recognised, the wrapper adds its own rules, and the failure —
 * if any — is a second registration rather than a module that no loader ever
 * sees.
 *
 * `experimental/test-unplugin` reads this exported table from the installed
 * package, drives every entry through one `next build --turbopack`, and asserts
 * root, nested, and deep `.ts`, `.tsx`, `.mts`, and `.cts` sources match
 * exactly the extension family recorded here. An entry therefore cannot be
 * recognised without that same build measuring it.
 */
const TYPESCRIPT_EXTENSION_NAMES = TYPESCRIPT_TRANSFORM_EXTENSIONS.map(
  (extension) => extension.slice(1),
);
const TYPESCRIPT_EXTENSION_GROUPS = extensionCombinations(
  TYPESCRIPT_EXTENSION_NAMES,
);

/**
 * Measured project-wide Turbopack globs and the source extensions each covers.
 *
 * Exported so the packed-package E2E can measure the exact production allowlist
 * instead of maintaining a second list that can drift from it.
 */
export const TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE: ReadonlyArray<
  readonly [string, readonly string[]]
> = Object.freeze([
  ...TYPESCRIPT_EXTENSION_NAMES.flatMap((extension) => {
    const extensions = Object.freeze([extension]);
    return [
      Object.freeze([`*.${extension}`, extensions] as const),
      Object.freeze([`**/*.${extension}`, extensions] as const),
      Object.freeze([`{**/,}*.${extension}`, extensions] as const),
    ];
  }),
  ...TYPESCRIPT_EXTENSION_GROUPS.flatMap(projectWideBraceGlobEntries),
]);
const PROJECT_WIDE_GLOBS: ReadonlyMap<string, readonly string[]> = new Map(
  TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE,
);

/** Every source-extension subset of size two or more, in shared-table order. */
function extensionCombinations(
  extensions: readonly string[],
): ReadonlyArray<readonly string[]> {
  const output: Array<readonly string[]> = [];
  const visit = (start: number, selected: string[]): void => {
    for (let index = start; index < extensions.length; index += 1) {
      const next = [...selected, extensions[index]!];
      if (next.length >= 2) output.push(Object.freeze(next));
      visit(index + 1, next);
    }
  };
  visit(0, []);
  return output;
}

/** Measured project-wide brace spellings for one extension family. */
function projectWideBraceGlobEntries(
  extensions: readonly string[],
): ReadonlyArray<readonly [string, readonly string[]]> {
  const suffixes = extensions.join(",");
  const alternatives = extensions
    .map((extension) => `*.${extension}`)
    .join(",");
  return [
    Object.freeze([`*.{${suffixes}}`, extensions] as const),
    Object.freeze([`{${alternatives}}`, extensions] as const),
    Object.freeze([`**/*.{${suffixes}}`, extensions] as const),
    Object.freeze([`**/{${alternatives}}`, extensions] as const),
    Object.freeze([`**/**/*.{${suffixes}}`, extensions] as const),
  ];
}

/**
 * Add one unconditional loader without flattening Next's rule collection.
 *
 * An array is either loader shorthand or a collection whose entries may be
 * complete conditional rule objects, so it must remain an array. A collection
 * executes every matching rule in order; its unconditional ttsc rule therefore
 * comes first so it sees the original source before any caller rule. A
 * conditioned object becomes that same two-item collection because putting ttsc
 * inside the condition would leave the rest of the glob uncovered. An
 * unconditioned object can keep its own shape while gaining the loader,
 * including when it had no loaders.
 */
function addUnconditionalTtscLoader(
  rule: unknown,
  entry: { loader: string; options: TtscUnpluginOptions },
): unknown {
  if (Array.isArray(rule)) {
    return rule.every(isTurbopackLoaderItem)
      ? [...rule, entry]
      : [{ loaders: [entry] }, ...rule];
  }
  if (typeof rule === "object" && rule !== null) {
    if ((rule as { condition?: unknown }).condition !== undefined) {
      return [{ loaders: [entry] }, rule];
    }
    return {
      ...rule,
      loaders: [...selectTurbopackConfigLoaders(rule), entry],
    };
  }
  return { loaders: [entry] };
}

/** Read the direct loader list from one Turbopack rule configuration item. */
function selectTurbopackConfigLoaders(rule: unknown): unknown[] {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
    return [];
  }
  const loaders = (rule as { loaders?: unknown }).loaders;
  return Array.isArray(loaders) ? loaders : [];
}

/** Whether a rule collection provides this loader without a condition. */
function hasUnconditionalTtscLoader(
  rule: unknown,
  resolvedLoaderResults: Map<string, boolean>,
): boolean {
  if (Array.isArray(rule)) {
    return rule.some((item) => {
      if (isTurbopackLoaderItem(item)) {
        return referencesTtscLoader(item, resolvedLoaderResults);
      }
      return (
        typeof item === "object" &&
        item !== null &&
        (item as { condition?: unknown }).condition === undefined &&
        selectTurbopackConfigLoaders(item).some((loader) =>
          referencesTtscLoader(loader, resolvedLoaderResults),
        )
      );
    });
  }
  return (
    typeof rule === "object" &&
    rule !== null &&
    (rule as { condition?: unknown }).condition === undefined &&
    selectTurbopackConfigLoaders(rule).some((loader) =>
      referencesTtscLoader(loader, resolvedLoaderResults),
    )
  );
}

/** Whether one collection item is a direct Turbopack loader. */
function isTurbopackLoaderItem(item: unknown): boolean {
  return (
    typeof item === "string" ||
    (typeof item === "object" &&
      item !== null &&
      typeof (item as { loader?: unknown }).loader === "string")
  );
}

/** Whether one Turbopack loader entry is already this package's loader. */
function referencesTtscLoader(
  loader: unknown,
  resolvedLoaderResults: Map<string, boolean>,
): boolean {
  const identity =
    typeof loader === "string"
      ? loader
      : typeof loader === "object" && loader !== null
        ? (loader as { loader?: unknown }).loader
        : undefined;
  return (
    typeof identity === "string" &&
    (identity === TURBOPACK_LOADER ||
      isResolvedTtscLoader(identity, resolvedLoaderResults))
  );
}

/** Whether an absolute path is the Turbopack entry of an @ttsc/unplugin copy. */
function isResolvedTtscLoader(
  identity: string,
  resolvedLoaderResults: Map<string, boolean>,
): boolean {
  const cached = resolvedLoaderResults.get(identity);
  if (cached !== undefined) {
    return cached;
  }
  let file: string;
  try {
    file = /^file:/i.test(identity) ? fileURLToPath(identity) : identity;
  } catch {
    resolvedLoaderResults.set(identity, false);
    return false;
  }
  if (!path.isAbsolute(file)) {
    resolvedLoaderResults.set(identity, false);
    return false;
  }
  let resolvedFile: string;
  try {
    resolvedFile = fs.realpathSync.native(file);
    if (!fs.statSync(resolvedFile).isFile()) {
      resolvedLoaderResults.set(identity, false);
      return false;
    }
  } catch {
    resolvedLoaderResults.set(identity, false);
    return false;
  }
  const packageRoot = path.dirname(path.dirname(resolvedFile));
  const relative = path
    .relative(packageRoot, resolvedFile)
    .replaceAll(path.sep, "/");
  if (relative !== "lib/turbopack.js" && relative !== "lib/turbopack.mjs") {
    resolvedLoaderResults.set(identity, false);
    return false;
  }
  let matches = false;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    ) as { name?: unknown };
    matches = manifest.name === "@ttsc/unplugin";
  } catch {
    // An unreadable or malformed owner cannot prove this package's identity.
  }
  resolvedLoaderResults.set(identity, matches);
  return matches;
}
