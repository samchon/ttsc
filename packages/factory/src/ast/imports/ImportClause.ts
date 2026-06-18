import type { Identifier } from "../names/Identifier";
import type { NamedImports } from "./NamedImports";
import type { NamespaceImport } from "./NamespaceImport";

/**
 * The clause of an import that binds names (default and/or named/namespace).
 *
 * Built by {@link factory.createImportClause}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportClause {
  /** Discriminant tag; always `"ImportClause"`. */
  kind: "ImportClause";

  /** Whether this is a type-only import/export. */
  isTypeOnly: boolean;

  /** The name. */
  name?: Identifier;

  /** The named or namespace bindings, if any. */
  namedBindings?: NamedImports | NamespaceImport;
}
