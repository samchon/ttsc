import type { InferTypeNode, TypeParameterDeclaration } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link InferTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameter The typeParameter.
 * @returns The created node.
 */
export const createInferTypeNode = (
  typeParameter: TypeParameterDeclaration,
): InferTypeNode => make("InferTypeNode", { typeParameter });
