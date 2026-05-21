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
   * Both keys are optional. The built-in defaults (`calls: ["console.log",
   * "console.debug", "assert.*"]`, `statements: ["debugger"]`) apply only when
   * *both* keys are omitted; declaring either key replaces both defaults with
   * exactly what the file lists.
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
