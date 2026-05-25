import path from "node:path";

import type { ITtscBannerPluginConfig } from "./structures";

export * from "./structures/index";

/**
 * The shape returned by a ttsc plugin factory function.
 *
 * Mirrors the ttsc plugin descriptor contract. The `source` field points to the
 * Go source directory that the host will compile and cache as either an
 * executable sidecar or linked native source.
 */
type TtscPluginDescriptor = {
  /** Human-readable plugin name used in logs and error messages. */
  name: string;
  /** Absolute path to the Go source directory for this plugin. */
  source: string;
  /**
   * Pipeline stage. `"transform"` plugins may rewrite source files; `"check"`
   * plugins only produce diagnostics. The framework default is `"transform"`.
   */
  stage?: "check" | "transform";
};

/**
 * Context object passed by the ttsc host to every plugin factory function.
 *
 * The factory may inspect the context to customise the descriptor — for example
 * selecting a different Go source directory based on `plugin` config — but most
 * factories ignore it.
 */
type TtscPluginFactoryContext<TConfig> = {
  /** Absolute path to the selected ttsc native helper, not a plugin binary. */
  binary: string;
  /** Working directory of the ttsc invocation. */
  cwd: string;
  /** The raw plugin entry from `compilerOptions.plugins[]`. */
  plugin: TConfig;
  /** Absolute path to the project root (directory containing tsconfig). */
  projectRoot: string;
  /** Absolute path to the resolved tsconfig. */
  tsconfig: string;
};

/**
 * Keys that the ttsc plugin host injects into every plugin entry and are not
 * owned by `@ttsc/banner`. These pass through the factory without validation so
 * the host can freely add new framework keys in the future.
 */
const FRAMEWORK_KEYS = new Set<string>([
  "enabled",
  "name",
  "stage",
  "transform",
]);

/**
 * Plugin factory for `@ttsc/banner` — called by the ttsc host to obtain the
 * plugin descriptor.
 *
 * The only banner-specific key accepted in the tsconfig plugin entry is
 * `configFile`. Any other key that is not a known framework key is rejected
 * with a specific error so users discover the correct configuration surface
 * (the dedicated config file) rather than silently receiving no banner.
 *
 * @internal
 */
export default function createTtscBanner(
  context: TtscPluginFactoryContext<ITtscBannerPluginConfig>,
): TtscPluginDescriptor {
  const entry = context.plugin as Record<string, unknown>;
  for (const key of Object.keys(entry)) {
    if (!FRAMEWORK_KEYS.has(key) && key !== "configFile") {
      throw new Error(
        `@ttsc/banner: tsconfig plugin entry contains unsupported key ${JSON.stringify(key)}. ` +
          `Banner options must be placed in a banner.config.{ts,cts,mts,js,cjs,mjs,json} file. ` +
          `The only accepted key in the tsconfig entry is "configFile" (optional path to the config file).`,
      );
    }
  }

  return {
    name: "@ttsc/banner",
    // Point at the `driver/` directory one level above `lib/` in the
    // installed package tree (where the Go sources live).
    source: path.resolve(__dirname, "..", "driver"),
    stage: "transform",
  };
}
