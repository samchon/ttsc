import type { Identifier } from "./Identifier";
import type { QualifiedName } from "./QualifiedName";

/**
 * A bare or qualified entity name: an {@link Identifier} or a dotted
 * {@link QualifiedName}, used by type references and import-equals aliases.
 *
 * @evidence contracts/common.md#principled-implementation Identifier and recursive QualifiedName represent bare and dotted entity references without admitting arbitrary expressions.
 * @evidence contracts/common.md#clear-and-simple-design This alias owns the two alternatives shared by type-name consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives describe syntax forms, not a special consumer or fixture.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes bare and qualified names and identifies type-reference and import-equals uses; concise separated prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type EntityName = Identifier | QualifiedName;
