import type { SyntaxKind } from "../../syntax";
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

  /**
   * The keyword between `import` and the bindings, when there is one.
   *
   * `TypeKeyword` is the type-only import; `DeferKeyword` is `import defer`.
   * Upstream calls the pair `ImportPhaseModifierSyntaxKind`, and this field
   * replaced a `isTypeOnly: boolean` that could not express the second phase at
   * all.
   */
  phaseModifier?: SyntaxKind.TypeKeyword | SyntaxKind.DeferKeyword;

  /** The name. */
  name?: Identifier;

  /** The named or namespace bindings, if any. */
  namedBindings?: NamedImports | NamespaceImport;
}
