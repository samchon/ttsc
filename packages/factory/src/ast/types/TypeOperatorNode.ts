import type { SyntaxKind } from "../../syntax";
import type { TypeNode } from "./TypeNode";

/**
 * A type operator, e.g. `keyof T` or `readonly T[]`.
 *
 * Built by {@link factory.createTypeOperatorNode}.
 *
 * SyntaxKind is broader than valid type operators. Callers supply a legal
 * operator such as keyof, readonly or unique and an appropriate operand.
 *
 * @evidence contracts/common.md#principled-implementation Operator code and TypeNode operand preserve prefix type-operator spelling; the broad code does not enforce keyword or operand legality.
 * @evidence contracts/common.md#clear-and-simple-design One operator field and one operand reuse the shared token codes and type representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Operator codes are language syntax, without fixture-specific type substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains legal-token responsibility and labels the operand; separated paragraphs follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeOperatorNode {
  /** Discriminant tag; always `"TypeOperatorNode"`. */
  kind: "TypeOperatorNode";

  /** The operator token. */
  operator: SyntaxKind;

  /** Operand following the prefix type operator. */
  type: TypeNode;
}
