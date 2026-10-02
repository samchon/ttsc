// native lint subcommand (`packages/lint/linthost/*.go`)

/**
 * Argument shape of a flag.
 *
 * - `boolean` — `--flag` with an optional spaced `true` / `false`. Launcher flags
 *   also accept `--flag=true` / `--flag=false`; tsgo-forwarded flags stay
 *   verbatim because pinned tsgo does not split `=`.
 * - `value` — `--flag value`. Launcher flags also accept `--flag=value`.
 * - `valueOptional` — `--flag` standalone is allowed; if followed by a non-flag
 *   token that token is consumed as the value. (Currently unused — declared for
 *   future flags like `--watch [path]`.)
 *
 * @evidence contracts/common.md#principled-implementation The literals encode the schema's token-arity distinctions; launcher-owned boolean and value rows are parsed locally while compiler-owned spellings retain the native parser's semantics. No current row uses valueOptional.
 * @evidence contracts/common.md#clear-and-simple-design Arity belongs to each FlagSpec through one small vocabulary instead of being inferred independently by every forwarding layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The documented distinction between launcher equals forms and native verbatim forwarding follows the pinned compiler's option grammar rather than patching its parser.
 * @evidence contracts/common.md#meaningful-documentation The native bullet list explains each arity and the equals-form boundary; it explicitly identifies the unused optional-value shape rather than implying an active CLI feature.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type FlagKind = "boolean" | "value" | "valueOptional";
