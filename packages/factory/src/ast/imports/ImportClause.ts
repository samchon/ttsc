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
 * @evidence contracts/common.md#principled-implementation Optional type/defer phase, default name and named/namespace bindings retain import clauses; legal phase/binding combinations remain caller responsibilities.
 * @evidence contracts/common.md#clear-and-simple-design One phase union distinguishes supported prefixes without overloading a boolean; shared binding nodes own their detail.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Type/defer values describe supported syntax rather than consumer-specific loading workarounds.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies binding clauses and explains phase alternatives and missing default binding; member paragraphs follow the documentation skill.
 */
export interface ImportClause {
  /** Discriminant tag; always `"ImportClause"`. */
  kind: "ImportClause";

  /**
   * The keyword between `import` and the bindings, when there is one.
   *
   * `TypeKeyword` is the type-only import; `DeferKeyword` is `import defer`.
   * Upstream calls the pair `ImportPhaseModifierSyntaxKind`. Absence means an
   * ordinary value import with no phase keyword.
   */
  phaseModifier?: SyntaxKind.TypeKeyword | SyntaxKind.DeferKeyword;

  /**
   * Default import binding; omitted when only named or namespace bindings
   * exist.
   */
  name?: Identifier;

  /** The named or namespace bindings, if any. */
  namedBindings?: NamedImports | NamespaceImport;
}
