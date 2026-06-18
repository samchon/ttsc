import type { EntityName, ImportTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ImportTypeNode}: an `import("module").Qualifier<Args>` type.
 *
 * The `argument` is the module specifier inside `import(...)`. A `qualifier`
 * adds a `.Member` access, and type arguments add `<...>`. When `isTypeOf` is
 * true the whole thing is prefixed with `typeof ` to query a value's type.
 *
 * Given the module `"foo"`, qualifier `Bar`, and a single `string` type
 * argument, the printer renders:
 *
 * ```ts
 * import("foo").Bar<string>;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param argument The module specifier inside `import(...)`.
 * @param qualifier The `.Member` access on the import, if any.
 * @param typeArguments The generic type arguments, if any.
 * @param isTypeOf Whether to prefix the type with `typeof`.
 * @returns The created {@link ImportTypeNode}.
 */
export const createImportTypeNode = (
  argument: TypeNode,
  qualifier?: EntityName,
  typeArguments?: readonly TypeNode[],
  isTypeOf: boolean = false,
): ImportTypeNode =>
  make("ImportTypeNode", { argument, qualifier, typeArguments, isTypeOf });
