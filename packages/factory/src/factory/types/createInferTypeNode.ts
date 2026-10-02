import type { InferTypeNode, TypeParameterDeclaration } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link InferTypeNode}: an `infer R` type used inside the extends
 * clause of a conditional type.
 *
 * The `infer ` keyword prints in front of the type parameter, including a
 * supplied constraint such as `R extends string`. In postfix
 * and array positions the surrounding printer wraps the infer type in
 * parentheses so `infer R[]` does not read as an array.
 *
 * Given a type parameter named `R`, the printer renders:
 *
 * ```ts
 * infer R
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   InferTypeNode retains its type parameter, including a supplied constraint;
 *   the caller places it in a context where infer is grammatically permitted.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One parameter child represents inference syntax; actual conditional-type
 *   inference belongs to the compiler rather than this outline constructor.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No inferred result or special type name is fabricated. The parameter node
 *   is preserved without replacing its constraint with an expected answer.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the inferred parameter and illustrates infer syntax, with
 *   the node argument separated from the acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameter The type parameter to infer.
 * @returns The created {@link InferTypeNode}.
 */
export const createInferTypeNode = (
  typeParameter: TypeParameterDeclaration,
): InferTypeNode => make("InferTypeNode", { typeParameter });
