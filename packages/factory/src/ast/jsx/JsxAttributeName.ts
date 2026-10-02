import type { Identifier } from "../names/Identifier";
import type { JsxNamespacedName } from "./JsxNamespacedName";

/**
 * The name of a {@link JsxAttribute}: an {@link Identifier} or a
 * {@link JsxNamespacedName}.
 *
 * @evidence contracts/common.md#principled-implementation Identifier and JsxNamespacedName retain bare and colon-qualified attribute spellings without computing property access.
 * @evidence contracts/common.md#clear-and-simple-design A two-variant name alias shares attribute spelling boundaries with concrete name nodes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No component-specific attribute-name whitelist or rename workaround is encoded.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies attribute names and colon-qualified alternatives via native links; separated prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type JsxAttributeName = Identifier | JsxNamespacedName;
