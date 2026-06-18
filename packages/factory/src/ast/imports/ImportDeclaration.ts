import type { Expression } from "../expressions/Expression";
import type { ModifierLike } from "../names/ModifierLike";
import type { ImportClause } from "./ImportClause";

/**
 * An `import` declaration.
 *
 * Built by {@link factory.createImportDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportDeclaration {
  /** Discriminant tag; always `"ImportDeclaration"`. */
  kind: "ImportDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The import clause; omitted for a side-effect-only import. */
  importClause?: ImportClause;

  /** The module specifier (the `from` target). */
  moduleSpecifier: Expression;
}
