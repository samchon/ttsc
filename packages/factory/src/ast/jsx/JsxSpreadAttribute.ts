import type { Expression } from "../expressions/Expression";

/**
 * A spread attribute in a JSX element, e.g. `{...props}`.
 *
 * Built by {@link factory.createJsxSpreadAttribute}.
 *
 * @evidence contracts/common.md#principled-implementation Required Expression records the operand in a spread attribute container without evaluating or enumerating its runtime properties.
 * @evidence contracts/common.md#clear-and-simple-design One operand field leaves attribute ordering to JsxAttributes and operand structure to Expression.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The node stores spread syntax instead of monkey patching component props or foreign objects.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates attribute spread and identifies its operand; separated member comments follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxSpreadAttribute {
  /** Discriminant tag; always `"JsxSpreadAttribute"`. */
  kind: "JsxSpreadAttribute";

  /** Operand whose properties are spread into the JSX attribute list. */
  expression: Expression;
}
