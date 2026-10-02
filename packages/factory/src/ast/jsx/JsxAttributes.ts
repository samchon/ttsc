import type { JsxAttributeLike } from "./JsxAttributeLike";

/**
 * The ordered collection of attributes attached to a JSX opening element.
 *
 * Built by {@link factory.createJsxAttributes}.
 *
 * @evidence contracts/common.md#principled-implementation Ordered named/spread attributes preserve their printed sequence without adding braces around the whole list or resolving duplicate properties.
 * @evidence contracts/common.md#clear-and-simple-design One collection owns attribute ordering while each variant owns its name/value or spread operand.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The collection retains caller attributes rather than injecting fixture-specific component props.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies ordered opening attributes and the property sequence; native member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxAttributes {
  /** Discriminant tag; always `"JsxAttributes"`. */
  kind: "JsxAttributes";

  /** The attribute properties. */
  properties: readonly JsxAttributeLike[];
}
