import type { Expression } from "./Expression";

/**
 * A spread element in an argument or array, e.g. `...items`.
 *
 * Built by {@link factory.createSpreadElement}.
 *
 * It represents expansion in value or argument lists and rest syntax in an
 * array assignment target. The type does not check iterability, rest position
 * or target validity.
 *
 * @evidence contracts/common.md#principled-implementation The expression operand and spread-element kind retain ... syntax across supported list contexts; iterability and assignment-rest restrictions remain caller premises.
 * @evidence contracts/common.md#clear-and-simple-design One operand describes the list entry; the enclosing call or array owns expansion position and separators.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Expansion is not replaced with elements enumerated from a known fixture or a patched iterator.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains expansion versus assignment-rest use and validation limits; member comments and tags remain distinct under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SpreadElement {
  /** Discriminant tag; always `"SpreadElement"`. */
  kind: "SpreadElement";

  /** The expression. */
  expression: Expression;
}
