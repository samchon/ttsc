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

  /**
   * Current parsing frame; callers remove an explicit leading command when
   * present.
   */
  readonly argv: readonly string[];

  /**
   * Error prefix used when the parser throws (`"ttsc:"` or `"ttsx:"`). The
   * engine itself is product-neutral; the caller controls the brand.
   */
  readonly errorPrefix: string;

  /**
   * Observe a validated launcher assignment at its compiler-frame position.
   * The canonical schema name and parsed value retain alias/value semantics;
   * passthroughIndex counts compiler tokens already forwarded at this point.
   * Exceptions propagate from the caller's observer.
   *
   * @evidence contracts/common.md#principled-implementation Canonical validated assignments and their original forwarded-token positions let the launcher retain compiler-frame order without reparsing aliases or scalar operands.
   * @evidence contracts/common.md#clear-and-simple-design One optional observer reports consumed assignments; parseFlags owns validation/consumption and the caller owns which metadata it retains.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This declared callback conveys existing parser decisions rather than changing compiler parsing, adding a second grammar or inspecting caller-specific paths.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines canonical names, parsed values, frame coordinates and propagated observer errors; this is a function-valued contract rather than a data-property acknowledgment.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The callback signature specifies assignment metadata without choosing a filesystem or process operation; any native behavior belongs to its supplied implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This signature chooses no observation algorithm; invocation frequency belongs to parseFlags and processing belongs to the supplied observer.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature coordinates no cross-invocation computation; retained metadata and reuse belong to its caller.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This function contract acquires no state or handles; the supplied callback and invoking parser own their lifetimes.
   */
  readonly onConsumedFlag?: (
    name: string,
    value: string | boolean | number,
    passthroughIndex: number,
  ) => void;

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
   * When omitted, an unconsumed nonempty bare token in the active parser head
   * is positional, except that runner first-positional mode still forwards
   * unconsumed response-file tokens. Tokens after an honored separator or the
   * runner entry belong to passthrough or the program tail without this
   * policy.
   *
   * When provided, a bare token that fails the predicate is appended to
   * `passthrough` in its original position instead of `positional`, so an
   * unknown `--flag value` pair reaches tsgo with its adjacency and relative
   * order intact. The native occurrence reader consumes compiler-owned operands
   * before this predicate runs, using scalar, list and config-only metadata.
   * Unconsumed lookahead remains a bare token, including whitespace the native
   * list parser does not consume; empty tokens stay compiler passthrough and do
   * not become launcher positionals.
   *
   * The main loop and schema-known non-native forwarding consult this policy
   * only before program-tail forwarding and after native operand consumption.
   * Empty-token and runner response-file handling remain separate parser
   * rules.
   *
   * @evidence contracts/common.md#principled-implementation The predicate classifies only bare tokens whose arity is not already owned by the schema or compiler table, preserving their original position when they are forwarded values.
   * @evidence contracts/common.md#clear-and-simple-design One optional callback exposes the caller's positional grammar while parseFlags owns token consumption and result partitioning.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This documented injection point supplies caller policy without patching the compiler parser or guessing from fixture paths inside parseFlags.
   * @evidence contracts/common.md#meaningful-documentation The comment explains absence, precedence and ordered forwarding, with separate paragraphs following the documentation skill; this is a function-valued contract, not a data-property acknowledgment.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This function-valued contract has no implementation or retained owner here; the supplied callback and invoking parser own their state and lifetimes.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This signature chooses no token-classification algorithm; parser invocation frequency and the supplied callback's text processing are reviewed at their respective implementations.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This signature coordinates no computation across consumers; any callback-owned shared work belongs to its implementation.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The callback signature defines a boolean token decision without specifying filesystem or process operations; any such behavior belongs to the supplied implementation, not an assumed pure body here.
   */
  readonly isPositional?: (token: string) => boolean;
}
