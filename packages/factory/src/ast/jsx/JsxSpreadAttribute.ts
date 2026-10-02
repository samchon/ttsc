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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxSpreadAttribute {
  /** Discriminant tag; always `"JsxSpreadAttribute"`. */
  kind: "JsxSpreadAttribute";

  /** Operand whose properties are spread into the JSX attribute list. */
  expression: Expression;
}
