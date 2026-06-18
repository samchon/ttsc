import type {
  Identifier,
  ImportClause,
  NamedImports,
  NamespaceImport,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ImportClause}.
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
