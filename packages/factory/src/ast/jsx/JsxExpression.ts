import type { Expression } from "../expressions/Expression";
import type { Token } from "../names/Token";

/**
 * An embedded expression within JSX, e.g. `{value}` or `{...value}`.
 *
 * Built by {@link factory.createJsxExpression}.
 *
 * An absent expression yields an empty container. The broad optional spread
 * marker does not enforce which JSX positions permit spread children.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Optional expression and spread presence preserve JSX brace-container parts, including empty containers; positional spread legality remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design Expression payload and optional spread marker are independent fields without component runtime state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Container contents are supplied syntax rather than hidden evaluation or consumer-specific component behavior.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains empty-container and spread-position limits separately; member spacing follows the documentation skill.
 */
export interface JsxExpression {
  /** Discriminant tag; always `"JsxExpression"`. */
  kind: "JsxExpression";

  /** The `...` token, if a spread. */
  dotDotDotToken?: Token;

  /** The expression, if any. */
  expression?: Expression;
}
