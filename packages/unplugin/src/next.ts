import type { TtscUnpluginOptions } from "./core/options";
import webpack from "./webpack";

/** The standalone loader entry Turbopack accepts through `turbopack.rules`. */
const TURBOPACK_LOADER = "@ttsc/unplugin/turbopack";
/**
 * The globs the loader is wired for.
 *
 * The same two the manual wiring in the README uses. A wider glob would be
 * harmless, since `isTransformTarget` declines everything else that reaches the
 * loader, but it would also route files through a worker for nothing.
 */
const TURBOPACK_RULE_GLOBS = ["*.ts", "*.tsx"];

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
 * Next refuses to build on Turbopack when a config carries a `webpack` hook and
 * no `turbopack` block, because the webpack hook is then silently ignored. This
 * wrapper always defines both, so that check can never fire again for anyone
 * who uses it, and a caller's own webpack customisation would be dropped on a
 * Turbopack build with nothing said. Wiring ttsc for Turbopack is worth exactly
 * one warning, not the loss of the warning Next already gave.
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
      "Next.js will not warn that your own `webpack` hook is ignored on a " +
      "Turbopack build. Port it to `turbopack`, or run the bundler you " +
      "configured with `next build --webpack` / `next dev --webpack`." +
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
  for (const glob of TURBOPACK_RULE_GLOBS) {
    const rule = rules[glob];
    const loaders = selectTurbopackLoaders(rule);
    if (loaders.some(referencesTtscLoader)) {
      continue;
    }
    // The caller may have written the same file set under a different glob.
    // Adding ours beside theirs makes every matching module run the loader
    // twice, and the second pass receives the first pass's output, so the
    // guard has to cover the spellings a caller plausibly uses rather than
    // only the two this wrapper writes (samchon/ttsc#1314).
    if (coveredByAnotherRule(rules, glob)) {
      continue;
    }
    const entry = { loader: TURBOPACK_LOADER, options: options ?? {} };
    // Appended, not prepended. Turbopack runs a rule's loaders through
    // webpack's own `loader-runner`, which runs the normal phase right to
    // left, so the last entry is the one that sees the original source. ttsc
    // transforms TypeScript into TypeScript, so it has to be that one, which
    // is the same position `enforce: "pre"` gives it on the webpack half.
    rules[glob] =
      rule === undefined || loaders.length === 0
        ? { loaders: [entry] }
        : Array.isArray(rule)
          ? { loaders: [...loaders, entry] }
          : { ...(rule as object), loaders: [...loaders, entry] };
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
): boolean {
  const extension = glob.slice(glob.lastIndexOf(".") + 1);
  return Object.entries(rules).some(([candidate, rule]) => {
    if (candidate === glob) {
      return false;
    }
    if (!selectTurbopackLoaders(rule).some(referencesTtscLoader)) {
      return false;
    }
    return matchesExtension(candidate, extension);
  });
}

/**
 * Whether one glob names this extension across the whole project.
 *
 * Unscoped only. A rule restricted to a path, `src/*.{ts,tsx}` or
 * `node_modules/**` + `/*.ts`, covers its own subtree and says nothing about
 * the rest of the project, so treating it as covering everything would leave
 * every module outside that subtree with no ttsc rule at all. That is the
 * silent failure samchon/ttsc#1310 is about, and it is strictly worse than the
 * double registration this guard exists to prevent: a build that transforms
 * twice is wrong loudly, a build that never transforms is wrong quietly.
 *
 * Recognition is one rule rather than a list of shapes: expand a brace group
 * into the globs it stands for, drop any leading `**` + `/` segments, and ask
 * whether what remains is exactly `*.<extension>`. That covers every spelling a
 * caller plausibly writes for "every file with this extension" — `*.ts`, `**` +
 * `/*.ts`, `*.{ts,tsx}`, `**` + `/{*.ts,*.tsx}`, `{**` + `/,}*.ts` — without
 * deciding glob equivalence in general.
 *
 * Expanding the brace before the test is what keeps the scoped case safe.
 * `src/*.{ts,tsx}` expands to `src/*.ts` and `src/*.tsx`, neither of which
 * survives the test, because the path segment is still there once the group is
 * gone. A group that spans the scope itself is judged the same way:
 * `{src/,}*.ts` offers `*.ts` among its alternatives, and that alternative
 * really does name every file, so recognising it is correct rather than a
 * leak.
 *
 * Two shapes stay unrecognised and deliberately so, since both fail in the loud
 * direction: a character class (`*.[jt]s`) and a different case (`*.TS`).
 */
function matchesExtension(glob: string, extension: string): boolean {
  return expandBraceGroup(glob).some((candidate) => {
    let unprefixed = candidate;
    while (unprefixed.startsWith("**/")) {
      unprefixed = unprefixed.slice(3);
    }
    return unprefixed === `*.${extension}`;
  });
}

/**
 * Expand the first brace group in a glob into the globs it stands for, keeping
 * whatever surrounds it.
 *
 * `*.{ts,tsx}` becomes `*.ts` and `*.tsx`; `{**` + `/,}*.ts` becomes `**` +
 * `/*.ts` and `*.ts`. One group is enough: nothing a caller writes for two
 * extensions needs two, and a glob with no group is returned unchanged, so
 * {@link matchesExtension} has a single shape to test either way.
 */
function expandBraceGroup(glob: string): string[] {
  const open = glob.indexOf("{");
  const close = glob.indexOf("}", open + 1);
  if (open === -1 || close === -1) {
    return [glob];
  }
  const prefix = glob.slice(0, open);
  const suffix = glob.slice(close + 1);
  return glob
    .slice(open + 1, close)
    .split(",")
    .map((part) => `${prefix}${part.trim()}${suffix}`);
}

/**
 * Read the loader list out of one Turbopack rule.
 *
 * Turbopack accepts a bare array of loaders as well as the object form, and a
 * loader is either a module name or a `{ loader, options }` pair, so this
 * normalises only enough to answer "what is already here".
 */
function selectTurbopackLoaders(rule: unknown): unknown[] {
  if (Array.isArray(rule)) {
    return rule;
  }
  if (typeof rule === "object" && rule !== null) {
    const loaders = (rule as { loaders?: unknown }).loaders;
    if (Array.isArray(loaders)) {
      return loaders;
    }
  }
  return [];
}

/** Whether one Turbopack loader entry is already this package's loader. */
function referencesTtscLoader(loader: unknown): boolean {
  if (typeof loader === "string") {
    return loader === TURBOPACK_LOADER;
  }
  return (
    typeof loader === "object" &&
    loader !== null &&
    (loader as { loader?: unknown }).loader === TURBOPACK_LOADER
  );
}
