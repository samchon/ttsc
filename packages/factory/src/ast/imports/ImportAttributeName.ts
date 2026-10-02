import type { StringLiteral } from "../expressions/StringLiteral";
import type { Identifier } from "../names/Identifier";

/**
 * The name of an {@link ImportAttribute}: either an identifier or a string
 * literal.
 *
 * @evidence contracts/common.md#principled-implementation Identifier and StringLiteral retain bare and quoted attribute keys without admitting computed names.
 * @evidence contracts/common.md#clear-and-simple-design A shared two-variant alias owns key alternatives for ImportAttribute.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Syntax alternatives do not whitelist fixture-specific attribute names.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the owning attribute and distinguishes quoted keys; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ImportAttributeName = Identifier | StringLiteral;
