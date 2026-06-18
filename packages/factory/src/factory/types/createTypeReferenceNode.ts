import type { EntityName, TypeNode, TypeReferenceNode } from "../../ast";
import { asEntityName } from "../internal/asEntityName";
import { make } from "../internal/make";

/**
 * Create a {@link TypeReferenceNode}: a named type reference such as
 * `Array<string>` or `ns.Foo`.
 *
 * The type name prints first and may be a qualified name, followed by the type
 * arguments as `<...>` when present. With no type arguments only the bare name
 * prints. A string name is normalized to an entity name.
 *
 * Given the name `Array` and a single `string` type argument, the printer
 * renders:
 *
 * ```ts
 * Array<string>;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeName The referenced type name.
 * @param typeArguments The generic type arguments, if any.
 * @returns The created {@link TypeReferenceNode}.
 */
export const createTypeReferenceNode = (
  typeName: string | EntityName,
  typeArguments?: readonly TypeNode[],
): TypeReferenceNode =>
  make("TypeReferenceNode", {
    typeName: asEntityName(typeName),
    typeArguments,
  });
