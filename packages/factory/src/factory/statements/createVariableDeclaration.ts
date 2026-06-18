import type {
  Expression,
  Identifier,
  Token,
  TypeNode,
  VariableDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link VariableDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @param exclamationToken The definite-assignment marker (`!`), if any.
 * @param type The type.
 * @param initializer The initializer, if any.
 * @returns The created {@link VariableDeclaration}.
 */
export const createVariableDeclaration = (
  name: string | Identifier,
  exclamationToken?: Token,
  type?: TypeNode,
  initializer?: Expression,
): VariableDeclaration =>
  make("VariableDeclaration", {
    name: asName(name),
    exclamationToken,
    type,
    initializer,
  });
