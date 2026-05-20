import path from "node:path";

import type { ITtscBannerPluginConfig } from "./structures";

export * from "./structures/index";

/**
 * The shape returned by a ttsc plugin factory function.
 *
 * Mirrors the `driver.PluginDescriptor` contract in the Go host. The `source`
 * field points to the Go source directory that the host will compile into a
 * plugin binary (cached under `.ttsc/`).
 */
type TtscPluginDescriptor = {
  /** Human-readable plugin name used in logs and error messages. */
  name: string;
  /** Absolute path to the Go source directory for this plugin. */
  source: string;
  /**
   * Pipeline stage. `"transform"` plugins may rewrite source files; `"check"`
   * plugins only produce diagnostics. Defaults to `"check"`.
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
  /**
   * Absolute path to the compiled plugin binary (not yet built at factory
   * time).
   */
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
 * Plugin factory for `@ttsc/banner` — called by the ttsc host to obtain the
 * plugin descriptor.
 *
 * The factory is intentionally minimal: the banner plugin has no factory-level
 * configuration that would alter which Go source to compile. All banner options
 * (text, config path, enabled flag) are read at transform time by the Go
 * driver.
 *
 * @internal
 */
export default function createTtscBanner(
  _context: TtscPluginFactoryContext<ITtscBannerPluginConfig>,
): TtscPluginDescriptor {
  return {
    name: "@ttsc/banner",
    // Point at the `driver/` directory one level above `lib/` in the
    // installed package tree (where the Go sources live).
    source: path.resolve(__dirname, "..", "driver"),
    stage: "transform",
  };
}
