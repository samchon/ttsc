import type { StringLiteral } from "../expressions/StringLiteral";
import type { Identifier } from "../names/Identifier";

/**
 * The name of a namespace / module declaration.
 *
 * @evidence contracts/common.md#principled-implementation Identifier and StringLiteral retain namespace/internal names versus quoted external module names without interpreting module identity.
 * @evidence contracts/common.md#clear-and-simple-design A two-variant alias owns the name distinction while ModuleDeclaration owns body and keyword policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Names are supplied syntax rather than hardcoded module aliases for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies module-declaration naming and native links expose both alternatives; tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ModuleName = Identifier | StringLiteral;
