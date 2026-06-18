import type { Expression } from "../expressions/Expression";

/**
 * A spread attribute in a JSX element, e.g. `{...props}`.
 *
 * Built by {@link factory.createJsxSpreadAttribute}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxSpreadAttribute {
  /** Discriminant tag; always `"JsxSpreadAttribute"`. */
  kind: "JsxSpreadAttribute";

  /** The expression. */
  expression: Expression;
}
