import type { Expression } from "../expressions/Expression";
import type { Token } from "../names/Token";

/**
 * An embedded expression within JSX, e.g. `{value}` or `{...value}`.
 *
 * Built by {@link factory.createJsxExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxExpression {
  /** Discriminant tag; always `"JsxExpression"`. */
  kind: "JsxExpression";

  /** The `...` token, if a spread. */
  dotDotDotToken?: Token;

  /** The expression, if any. */
  expression?: Expression;
}
