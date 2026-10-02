import type { Expression } from "../expressions/Expression";

/**
 * A `require("...")` reference of an import-equals declaration.
 *
 * Built by {@link factory.createExternalModuleReference}.
 *
 * The operand normally is a module string literal. The broad Expression
 * representation does not enforce that restriction or perform loading.
 *
 * @evidence contracts/common.md#principled-implementation The wrapper preserves require-style import-equals reference syntax; its broad expression does not certify a valid module operand.
 * @evidence contracts/common.md#clear-and-simple-design One operand field leaves binding placement to ImportEqualsDeclaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is a syntax node, without foreign loader replacement or consumer-name resolution hacks.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies import-equals context and module-operand restriction in separate paragraphs following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ExternalModuleReference {
  /** Discriminant tag; always `"ExternalModuleReference"`. */
  kind: "ExternalModuleReference";

  /** Module operand inside require(...), normally a string literal. */
  expression: Expression;
}
