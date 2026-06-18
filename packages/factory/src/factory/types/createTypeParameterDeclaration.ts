import type {
  Identifier,
  ModifierLike,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link TypeParameterDeclaration}: a generic parameter such as `T
 * extends string = number`.
 *
 * Any modifiers print first (for example `const`, `in`, `out`), then the name.
 * A constraint adds ` extends Type` and a default adds ` = Type`, each only
 * when present. A string name is normalized to an identifier.
 *
 * Given the name `T`, a `string` constraint, and a `number` default, the
 * printer renders:
 *
 * ```ts
 * T extends string = number
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The parameter name.
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
