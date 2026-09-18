/**
 * Per-subcommand parse result. `values` is keyed by the canonical flag name
 * (e.g. `"--singleThreaded"`); boolean flags resolve to `true`/`false`, value
 * flags to the parsed value type. Callers narrow with the helpers below
 * (`getBoolean`, `getString`, `getNumber`).
 */
export interface ParseResult {
  /** Canonical flag name → resolved value. */
  readonly values: ReadonlyMap<string, string | boolean | number>;
  /**
   * Canonical flag name → every accepted value, in argv order. Populated only
   * for flags declared `repeatable` in `FLAG_SCHEMA` (`ttsx -r a -r b`), where
   * the last-value-wins `values` entry is not the whole answer. Read it through
   * `getStringList`.
   */
  readonly repeated: ReadonlyMap<
    string,
    readonly (string | boolean | number)[]
  >;
  /** Flags the engine did not consume — forwarded to tsgo. */
  readonly passthrough: readonly string[];
  /** Bare non-flag positional arguments, in original order. */
  readonly positional: readonly string[];
  /**
   * Tokens that arrived after the `forwardAfterFirstPositional` sentinel. These
   * are intended for the user's program (e.g. ttsx's entry-file argv); they are
   * NOT forwarded to tsgo. Always empty when `forwardAfterFirstPositional` is
   * false.
   */
  readonly tail: readonly string[];
}
