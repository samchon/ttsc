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
 * Merge the ttsc loader rules into a caller's Turbopack configuration.
 *
 * Additive in every direction: unrelated Turbopack settings and unrelated rules
 * are carried through untouched, and a glob the caller already configured keeps
 * its own loaders with ttsc prepended, which is the `enforce: "pre"` ordering
 * the webpack half gets from unplugin. A caller who already wired this loader
 * by hand is left exactly as they are, so following the README's manual
 * instructions and then adopting the wrapper cannot register it twice.
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
    const entry = { loader: TURBOPACK_LOADER, options: options ?? {} };
    rules[glob] =
      rule === undefined || loaders.length === 0
        ? { loaders: [entry] }
        : { ...(rule as object), loaders: [entry, ...loaders] };
  }
  return { ...(existing ?? {}), rules };
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
