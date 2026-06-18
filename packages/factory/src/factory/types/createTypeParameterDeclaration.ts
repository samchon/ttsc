import type {
  Identifier,
  ModifierLike,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link TypeParameterDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param constraint The `extends` constraint, if any.
 * @param defaultType The default type, if any.
 * @returns The created {@link TypeParameterDeclaration}.
 */
export const createTypeParameterDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | Identifier,
  constraint?: TypeNode,
  defaultType?: TypeNode,
): TypeParameterDeclaration =>
  make("TypeParameterDeclaration", {
    modifiers,
    name: asName(name),
    constraint,
    default: defaultType,
  });
