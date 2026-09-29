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
