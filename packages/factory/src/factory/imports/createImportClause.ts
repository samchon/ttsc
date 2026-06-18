import type {
  Identifier,
  ImportClause,
  NamedImports,
  NamespaceImport,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ImportClause}: the part of an import statement between
 * `import` and `from`.
 *
 * The `name` is the default-import binding, if any. The `namedBindings` slot
 * holds either a {@link NamedImports} brace group or a {@link NamespaceImport}. A
 * default binding and named bindings can appear together, joined by a comma.
 * Set `isTypeOnly` to prefix the clause with `type`.
 *
 * Given a default binding `Def` plus named import `a`, this prints:
 *
 * ```ts
 * (Def, { a });
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param isTypeOnly Whether this is a type-only import/export.
 * @param name The name.
 * @param namedBindings The named or namespace bindings, if any.
 * @returns The created {@link ImportClause}.
 */
export const createImportClause = (
  isTypeOnly: boolean,
  name: Identifier | undefined,
  namedBindings: NamedImports | NamespaceImport | undefined,
): ImportClause => make("ImportClause", { isTypeOnly, name, namedBindings });
