import type { Expression } from "../expressions/Expression";
import type { ImportClause } from "../imports/ImportClause";
import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@import` JSDoc tag.
 *
 * Built by {@link factory.createJSDocImportTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocImportTag {
  /** Discriminant tag; always `"JSDocImportTag"`. */
  kind: "JSDocImportTag";

  /** The tag name, e.g. `import`. */
  tagName: Identifier;

  /** The import clause, if any. */
  importClause?: ImportClause;

  /** The module specifier. */
  moduleSpecifier: Expression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
