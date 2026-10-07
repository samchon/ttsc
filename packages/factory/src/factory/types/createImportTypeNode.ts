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
 * The parameter order follows the legacy factory: the module specifier,
 * attributes, qualifier and type arguments, then `isTypeOf`. Attributes belong
 * inside the import call as its second argument, rather than after a
 * statement's module specifier.
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
 * @param attributes The import-call attributes, if any.
 * @param qualifier The `.Member` access on the import, if any.
 * @param typeArguments The generic type arguments, if any.
 * @param isTypeOf Whether to prefix the type with `typeof`; defaults to false.
 * @returns The created {@link ImportTypeNode}.
 * @evidence contracts/common.md#principled-implementation
 *   The constructor preserves the module type, attributes, qualifier and type
 *   arguments in their import-type slots; only true enables typeof. The printer
 *   uses the attributes' import-call form rather than a statement clause.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Optional qualification and metadata are fields of one import type, avoiding
 *   separate variants for every combination and leaving punctuation to the printer.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Boolean normalization applies to every input; no module-name exceptions or
 *   raw text substitutions stand in for the argument and attribute nodes.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc records the parameter order and attribute context, separates the
 *   example from acknowledgments, and documents every argument in signature order.
 */
export const createImportTypeNode = (
  argument: TypeNode,
  attributes?: ImportAttributes,
  qualifier?: EntityName,
  typeArguments?: readonly TypeNode[],
  isTypeOf?: boolean,
): ImportTypeNode =>
  make("ImportTypeNode", {
    argument,
    attributes,
    qualifier,
    typeArguments,
    isTypeOf: isTypeOf === true,
  });
