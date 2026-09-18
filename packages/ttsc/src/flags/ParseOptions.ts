import type { AnySubcommand } from "./AnySubcommand";

/** Options controlling a single `parseFlags` invocation. */
export interface ParseOptions {
  /** Which subcommand's flag subset to accept. */
  readonly subcommand: AnySubcommand;
  /** Argv tail (the launcher has already split off the subcommand). */
  readonly argv: readonly string[];
  /**
   * Error prefix used when the parser throws (`"ttsc:"` or `"ttsx:"`). The
   * engine itself is product-neutral; the caller controls the brand.
   */
  readonly errorPrefix: string;
  /**
   * `true` to treat the FIRST positional token as a sentinel that switches the
   * engine to "forward everything after" mode (ttsx's entry-file behaviour:
   * tokens after the entry are runtime argv, not tsgo flags). The sentinel
   * itself is still recorded as a positional argument.
   */
  readonly forwardAfterFirstPositional?: boolean;
  /**
   * Optional `"--"` separator handling: when present in argv, every token after
   * `--` is appended to `passthrough` as-is (ttsx already does this).
   */
  readonly honorDoubleDashSeparator?: boolean;
  /**
   * Classifies a bare (non-dash) token as a genuine positional argument (a
   * source file, the ttsx entry, a project path) rather than the
   * space-separated value of a preceding forwarded flag.
   *
   * When omitted, every bare token is a positional — the historical behaviour
   * for project-shaped subcommands that never forward `--flag value` pairs.
   *
   * When provided, a bare token that fails the predicate is appended to
   * `passthrough` in its original position instead of `positional`, so an
   * unknown `--flag value` pair reaches tsgo with its adjacency and relative
   * order intact. The parser deliberately does not guess a forwarded flag's
   * arity from the flag itself (it has no schema for a truly unknown flag); the
   * predicate is the only signal that separates a forwarded value from a real
   * input file, and both callers key it on the TypeScript source extension.
   *
   * Every path that can move a bare token out of `positional` consults it: the
   * main loop below and `forwardKnownButUnaccepted`, which answers the same
   * question for a schema-known flag this subcommand does not accept.
   */
  readonly isPositional?: (token: string) => boolean;
}
