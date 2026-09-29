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
 */
export type FlagKind = "boolean" | "value" | "valueOptional";
