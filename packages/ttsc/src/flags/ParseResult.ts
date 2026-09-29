/**
 * Per-subcommand parse result. `values` is keyed by the canonical flag name
 * (e.g. `"--singleThreaded"`); boolean flags resolve to `true`/`false`, value
 * flags to the parsed value type. Callers narrow with the helpers below
 * (`getBoolean`, `getString`, `getNumber`).
 *
 * @evidence contracts/common.md#principled-implementation Canonical-name maps retain typed launcher values separately from ordered passthrough, positional and program-tail tokens; the repeated map preserves all occurrences when last-value selection is insufficient.
 * @evidence contracts/common.md#clear-and-simple-design Each result member names one destination or occurrence policy, so consumers need no second parsing pass to reconstruct compiler versus program arguments.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The separate tail prevents program arguments from becoming compiler flags, and canonical keys derive from FlagSpec instead of consumer-specific spelling checks.
 * @evidence contracts/common.md#meaningful-documentation Native member comments explain canonical keys, repetition ordering and the distinction between compiler passthrough and program tail; their separated presentation follows the documentation skill without member checklist tags.
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
