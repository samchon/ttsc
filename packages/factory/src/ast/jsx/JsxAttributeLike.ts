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
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxAttributeLike = JsxAttribute | JsxSpreadAttribute;
