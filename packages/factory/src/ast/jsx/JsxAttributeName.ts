import type { Identifier } from "../names/Identifier";
import type { JsxNamespacedName } from "./JsxNamespacedName";

/**
 * The name of a {@link JsxAttribute}: an {@link Identifier} or a
 * {@link JsxNamespacedName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Identifier and JsxNamespacedName retain bare and colon-qualified attribute spellings without computing property access.
 * @evidence contracts/common.md#clear-and-simple-design A two-variant name alias shares attribute spelling boundaries with concrete name nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No component-specific attribute-name whitelist or rename workaround is encoded.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies attribute names and colon-qualified alternatives via native links; separated prose follows the documentation skill.
 */
export type JsxAttributeName = Identifier | JsxNamespacedName;
