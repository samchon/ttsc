/**
 * Plugin descriptor factory consumed by ttsc's package discovery.
 *
 * `@ttsc/strip` is configured through a `strip.config.*` file, never through
 * the factory context — the factory only returns the native descriptor.
 *
 * @internal
 */
declare function createTtscStrip(context: unknown): {
  name: string;
  source: string;
  stage: "transform";
};

declare namespace createTtscStrip {
  /**
   * Standalone `strip.config.{ts,cts,mts,js,cjs,mjs,json}` file shape consumed
   * by `@ttsc/strip`.
   *
   * Both keys are optional; an omitted key keeps the built-in default (`calls:
   * ["console.log", "console.debug", "assert.*"]`, `statements:
   * ["debugger"]`).
   */
  export interface ITtscStripConfig {
    /**
     * Statement-level call patterns to remove, written as dotted names. A
     * trailing `.*` wildcard matches any final property — e.g. `"assert.*"`
     * matches `assert.equal`, `assert.deepStrictEqual`, …
     */
    calls?: readonly string[];

    /** Bare statement kinds to remove. Currently only `"debugger"` is supported. */
    statements?: readonly string[];
  }
}

export = createTtscStrip;
