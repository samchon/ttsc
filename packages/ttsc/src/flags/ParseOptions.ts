import type { AnySubcommand } from "./AnySubcommand";

/**
 * Options controlling a single `parseFlags` invocation.
 *
 * @evidence contracts/common.md#principled-implementation The record makes command identity and argument ownership explicit; separator and first-positional modes distinguish compiler argv from the runner program's argv without embedding caller branding or filesystem classification into the parser.
 * @evidence contracts/common.md#clear-and-simple-design Parsing policy travels in one invocation record, with isPositional injecting only classification of tokens not already described by the flag schema or compiler table.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller-provided error prefix and positional predicate are explicit injection boundaries, not replacement of foreign parser behavior or project-specific special cases.
 * @evidence contracts/common.md#meaningful-documentation Native comments describe mode interaction, predicate absence and compiler-arity precedence, with separated member explanations applying the documentation skill's optional-state and paragraph guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
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
   * Enables `"--"` separator handling. Before the runner entry, following
   * tokens go to compiler passthrough. Directly after the entry, one separator
   * is consumed and following tokens go to the program tail; later program
   * separators remain program arguments.
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
   * order intact. The native occurrence reader consumes compiler-owned operands
   * before this predicate runs, using scalar, list and config-only metadata.
   * Unconsumed lookahead remains a bare token, including whitespace the native
   * list parser does not consume; empty tokens stay compiler passthrough and
   * do not become launcher positionals.
   *
   * Every path that can move a bare token out of `positional` consults it: the
   * main loop below and `forwardKnownButUnaccepted`, which answers the same
   * question for a schema-known flag this subcommand does not accept.
   *
   * @evidence contracts/common.md#principled-implementation The predicate classifies only bare tokens whose arity is not already owned by the schema or compiler table, preserving their original position when they are forwarded values.
   * @evidence contracts/common.md#clear-and-simple-design One optional callback exposes the caller's positional grammar while parseFlags owns token consumption and result partitioning.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This documented injection point supplies caller policy without patching the compiler parser or guessing from fixture paths inside parseFlags.
   * @evidence contracts/common.md#meaningful-documentation The comment explains absence, precedence and ordered forwarding, with separate paragraphs following the documentation skill; this is a function-valued contract, not a data-property acknowledgment.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isPositional acquires no handle, buffer or cache and retains nothing after it returns.
   * @evidenceExclude contracts/performance.md#efficient-algorithms isPositional performs a fixed number of steps with no loop or recursion over caller data.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work isPositional computes one result per call, so there is no repeated work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation isPositional computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
   */
  readonly isPositional?: (token: string) => boolean;
}
