import type { BunLoader } from "./BunLoader";

/**
 * Minimal subset of the Bun `BuildConfig` plugin build object.
 *
 * `onLoad` drives the source transform. Bun's bundler also exposes `onStart`
 * and `onEnd`, which bracket the shared plugin's build lifecycle. The runtime
 * plugin API omits those hooks, so plugin setup itself starts its one
 * process-scoped module-loading session.
 */
export interface BunLikeBuild {
  /**
   * Build configuration exposed unchanged by Bun's bundler plugin builder.
   *
   * Runtime plugin builders do not supply `files`. Bun's bundler accepts an
   * in-memory file map whose values deliberately remain `unknown` here because
   * this adapter only needs to preserve ownership, not consume their contents.
   */
  config?: {
    files?: Readonly<Record<string, unknown>>;
  };
  /**
   * Register a callback for the start of a bundler build.
   *
   * Optional because `Bun.plugin()` runtime builders do not expose this hook.
   */
  onStart?(callback: () => void | Promise<void>): void;
  /** Register a callback for deterministic bundler-session teardown. */
  onEnd?(callback: () => void | Promise<void>): void;
  /**
   * Register a loader callback for files matching `filter`.
   *
   * The callback receives the file path and must return the transformed file
   * contents plus the `loader` Bun should apply next. Configured in-memory
   * files retain relative key spellings; ordinary disk files are normally
   * absolute. The `loader` matters most for the runtime path (`Bun.plugin`),
   * where Bun must be told the returned contents are still TypeScript so it
   * keeps transpiling them before execution.
   */
  onLoad(
    options: { filter: RegExp },
    loader: (args: {
      path: string;
    }) => Promise<{ contents: string; loader: BunLoader } | undefined>,
  ): void;
}
