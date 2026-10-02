import type { EntityName, TypeNode, TypeReferenceNode } from "../../ast";
import { asEntityName } from "../internal/asEntityName";
import { make } from "../internal/make";

/**
 * Create a {@link TypeReferenceNode}: a named type reference such as
 * `Array<string>` or `ns.Foo`.
 *
 * The type name prints first and may be a qualified name, followed by the type
 * arguments as `<...>` when present. With no type arguments only the bare name
 * prints. A string name becomes a single identifier; callers representing a
 * qualified name should supply a structured {@link QualifiedName}.
 *
 * Given the name `Array` and a single `string` type argument, the printer
 * renders:
 *
 * ```ts
 * Array<string>
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   EntityName nodes are retained and strings become identifiers; ordered type
 *   arguments remain child types. Strings are not parsed into qualified-name trees.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Shared entity-name conversion owns the shorthand, while the reference
 *   carries only a name and optional arguments rather than resolving a symbol.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Type names do not select built-in templates or hidden argument defaults;
 *   qualified structure must be supplied rather than patched into rendered text.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose now states the string shorthand's actual limitation and points
 *   to QualifiedName; the example shows an unqualified generic reference.
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
