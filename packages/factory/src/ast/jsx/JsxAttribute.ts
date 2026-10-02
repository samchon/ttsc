import type { JsxAttributeName } from "./JsxAttributeName";
import type { JsxAttributeValue } from "./JsxAttributeValue";

/**
 * A single JSX attribute, e.g. `attr="x"` or `attr={value}` or bare `attr`.
 *
 * Built by {@link factory.createJsxAttribute}.
 *
 * @evidence contracts/common.md#principled-implementation Name and optional JsxAttributeValue preserve valued versus bare attributes; absence prints a bare name rather than manufacturing a boolean value node.
 * @evidence contracts/common.md#clear-and-simple-design Shared name/value unions own their alternatives while this node owns attachment and initializer presence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Names and values are supplied syntax without special component attributes for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates quoted, expression and bare attributes and explains omitted initializer; comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxAttribute {
  /** Discriminant tag; always `"JsxAttribute"`. */
  kind: "JsxAttribute";

  /** The name. */
  name: JsxAttributeName;

  /** Supplied attribute value; absent for a bare boolean attribute name. */
  initializer?: JsxAttributeValue;
}
