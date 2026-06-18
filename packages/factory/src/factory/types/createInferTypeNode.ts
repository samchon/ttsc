import type { InferTypeNode, TypeParameterDeclaration } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link InferTypeNode}: an `infer R` type used inside the extends
 * clause of a conditional type.
 *
 * The `infer ` keyword prints in front of the type parameter's name. In postfix
 * and array positions the surrounding printer wraps the infer type in
 * parentheses so `infer R[]` does not read as an array.
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
 */
export const createInferTypeNode = (
  typeParameter: TypeParameterDeclaration,
): InferTypeNode => make("InferTypeNode", { typeParameter });
