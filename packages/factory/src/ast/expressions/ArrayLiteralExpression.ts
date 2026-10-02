import type { Expression } from "./Expression";

/**
 * An array literal, e.g. `[1, 2, 3]`.
 *
 * Built by {@link factory.createArrayLiteralExpression}.
 *
 * Elements may include spread elements and holes. The outline stores syntax,
 * not evaluated array values; callers supply grammar-valid elements.
 *
 * @evidence contracts/common.md#principled-implementation Ordered expressions preserve array positions, spreads and elisions; the kind distinguishes a value literal from a binding pattern.
 * @evidence contracts/common.md#clear-and-simple-design Elements and an optional layout hint are the entire array outline; punctuation and width decisions belong to the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts multiLine explicitly requests layout and does not encode consumer-specific output or replace element values.
 * @evidence contracts/common.md#meaningful-documentation Native prose states syntax ownership and supported element forms, while the option explains forced versus width-selected line breaks under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ArrayLiteralExpression {
  /** Discriminant tag; always `"ArrayLiteralExpression"`. */
  kind: "ArrayLiteralExpression";

  /** The array elements. */
  elements: readonly Expression[];

  /** Force a broken layout when true; otherwise the printer chooses by width. */
  multiLine?: boolean;
}
