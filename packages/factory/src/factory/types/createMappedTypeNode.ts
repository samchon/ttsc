import type {
  MappedTypeNode,
  Token,
  TypeElement,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link MappedTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param readonlyToken The readonlyToken.
 * @param typeParameter The typeParameter.
 * @param nameType The nameType.
 * @param questionToken The questionToken.
 * @param type The type.
 * @param members The members.
 * @returns The created node.
 */
export const createMappedTypeNode = (
  readonlyToken: Token | undefined,
  typeParameter: TypeParameterDeclaration,
  nameType: TypeNode | undefined,
  questionToken: Token | undefined,
  type: TypeNode | undefined,
  members: readonly TypeElement[] | undefined,
): MappedTypeNode =>
  make("MappedTypeNode", {
    readonlyToken,
    typeParameter,
    nameType,
    questionToken,
    type,
    members,
  });
