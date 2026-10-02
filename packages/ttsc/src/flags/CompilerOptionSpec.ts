/**
 * Native command-line grammar of one pinned compiler option. Lists and
 * configuration-only options have their own lookahead rules; scalar options
 * consume a following dash-prefixed token as data.
 *
 * @evidence contracts/common.md#principled-implementation Kind, list element and configuration-only status preserve the distinctions consumed by the pinned native parser instead of collapsing every nonboolean option into one arity.
 * @evidence contracts/common.md#clear-and-simple-design One immutable metadata record describes grammar; occurrence reading separately owns argv lookahead and launcher FlagSpec separately owns launcher semantics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The generator obtains these fields from exported native declarations rather than help text, spelling exceptions or source-file suffix guesses.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the scalar, list and configuration-only distinctions; member comments state the source and optional element meaning.
 */
export interface CompilerOptionSpec {
  /** Canonical native name without leading dashes. */
  readonly name: string;

  /** The native declaration's value kind. */
  readonly kind: "boolean" | "string" | "number" | "enum" | "list" | "object";

  /** List element kind; absent for non-list declarations. */
  readonly element?: "string" | "enum" | "object";

  /** Whether CLI admission allows only false/null for booleans and null for other kinds. */
  readonly configOnly: boolean;
}
