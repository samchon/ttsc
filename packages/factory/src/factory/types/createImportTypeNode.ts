import type {
  EntityName,
  ImportAttributes,
  ImportTypeNode,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ImportTypeNode}: an `import("module").Qualifier<Args>` type.
 *
 * The parameter order is upstream's: `isTypeOf` first, then the module
 * specifier, then the `with { … }` attributes, then the qualifier and type
 * arguments. This factory used to put `isTypeOf` last and omit `attributes`
 * entirely, so a caller ported from `ts.factory` bound every argument to the
 * wrong slot.
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
  isTypeOf: boolean | undefined,
  argument: TypeNode,
  attributes?: ImportAttributes,
  qualifier?: EntityName,
  typeArguments?: readonly TypeNode[],
): ImportTypeNode =>
  make("ImportTypeNode", {
    argument,
    attributes,
    qualifier,
    typeArguments,
    isTypeOf: isTypeOf === true,
  });
