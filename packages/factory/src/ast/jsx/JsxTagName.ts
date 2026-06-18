import type { PropertyAccessExpression } from "../expressions/PropertyAccessExpression";
import type { Identifier } from "../names/Identifier";
import type { Token } from "../names/Token";
import type { JsxNamespacedName } from "./JsxNamespacedName";

/**
 * The tag name of a JSX element — an {@link Identifier}, a `this` keyword
 * {@link Token}, a dotted {@link PropertyAccessExpression}, or a
 * {@link JsxNamespacedName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxTagName =
  | Identifier
  | Token
  | PropertyAccessExpression
  | JsxNamespacedName;
