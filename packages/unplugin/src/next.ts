import type { TtscUnpluginOptions } from "./core/options";
import webpack from "./webpack";

/**
 * Minimal structural type for a Next.js configuration object.
 *
 * Only the `webpack` field is used by this adapter; all other Next.js options
 * are forwarded as-is through the spread operator.
 */
export type NextLikeConfig = Record<string, unknown> & {
  /**
   * Optional existing webpack customisation hook. When the caller has already
   * defined one, `next()` will chain through to it after injecting the ttsc
   * webpack plugin.
   */
  webpack?: (config: WebpackLikeConfig, options: unknown) => WebpackLikeConfig;
};

/**
 * Minimal structural type for a webpack configuration object as seen by the
 * Next.js `webpack` hook callback.
 */
export type WebpackLikeConfig = Record<string, unknown> & {
  /** The webpack plugin array; initialised to `[]` by this adapter if absent. */
  plugins?: unknown[];
};

/**
 * Wrap a Next.js config object so that the ttsc webpack plugin is injected into
 * every webpack build Next.js performs.
 *
 * The adapter uses `unshift` to ensure the ttsc plugin runs before any other
 * plugins in the array (unplugin `enforce: "pre"` semantics). An existing
 * `nextConfig.webpack` hook is preserved and called after the plugin is
 * injected.
 *
 * @param nextConfig - The caller's existing Next.js config (spread into the
 *   returned object unchanged, except for `webpack`).
 * @param options - Ttsc plugin options forwarded to the webpack adapter.
 */
export default function next(
  nextConfig: NextLikeConfig = {},
  options?: TtscUnpluginOptions,
): NextLikeConfig {
  return {
    ...nextConfig,
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
