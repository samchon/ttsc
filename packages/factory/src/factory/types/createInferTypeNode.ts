import type { InferTypeNode, TypeParameterDeclaration } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link InferTypeNode}: an `infer R` type used inside the extends
 * clause of a conditional type.
 *
 * The `infer ` keyword prints in front of the type parameter, including a
 * supplied constraint such as `R extends string`. In postfix and array
 * positions the surrounding printer wraps the infer type in parentheses so
 * `infer R[]` does not read as an array.
 *
 * Given a type parameter named `R`, the printer renders:
 *
 * ```ts
 * infer R
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameter The type parameter to infer.
 * @returns The created {@link InferTypeNode}.
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
 */
export const createInferTypeNode = (
  typeParameter: TypeParameterDeclaration,
): InferTypeNode => make("InferTypeNode", { typeParameter });
