import type { JsxAttribute } from "./JsxAttribute";
import type { JsxSpreadAttribute } from "./JsxSpreadAttribute";

/**
 * Any node that may appear as a property of {@link JsxAttributes}: a
 * {@link JsxAttribute} or a {@link JsxSpreadAttribute}.
 *
 * @evidence contracts/common.md#principled-implementation The union distinguishes named attributes from spread-expression attributes without admitting unrelated children.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns opening-element attribute alternatives and preserves interleaving through the parent list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives represent JSX syntax rather than consumer component-specific properties.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies attribute-list ownership and both variants through native links; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxAttributeLike = JsxAttribute | JsxSpreadAttribute;
