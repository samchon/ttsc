import type { TtscUnpluginOptions } from "./core/options";
import webpack from "./webpack";

export type NextLikeConfig = Record<string, unknown> & {
  webpack?: (config: WebpackLikeConfig, options: unknown) => WebpackLikeConfig;
};

export type WebpackLikeConfig = Record<string, unknown> & {
  plugins?: unknown[];
};

export default function next(
  nextConfig: NextLikeConfig = {},
  options?: TtscUnpluginOptions,
): NextLikeConfig {
  return {
    ...nextConfig,
    webpack(config: WebpackLikeConfig, webpackOptions: unknown) {
      config.plugins = Array.isArray(config.plugins) ? config.plugins : [];
      config.plugins.unshift(webpack(options));
      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, webpackOptions);
      }
      return config;
    },
  };
}
