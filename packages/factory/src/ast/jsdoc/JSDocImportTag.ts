import type { Expression } from "../expressions/Expression";
import type { ImportAttributes } from "../imports/ImportAttributes";
import type { ImportClause } from "../imports/ImportClause";
import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@import` JSDoc tag.
 *
 * Built by {@link factory.createJSDocImportTag}.
 *
 * Omitting importClause removes both the bindings and `from`, leaving the
 * module expression. Attributes follow that expression when present. Although
 * moduleSpecifier accepts Expression, the caller must supply module syntax
 * accepted by its JSDoc consumer; no module resolution occurs here.
 *
 * @evidence contracts/common.md#principled-implementation Optional bindings and attributes plus a required module expression retain the import annotation's printable parts, but the broad Expression field does not ensure a valid string module specifier or resolve it.
 * @evidence contracts/common.md#clear-and-simple-design Shared import-clause and attribute nodes own their existing syntax, so this tag only combines them with a module operand and description.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Module syntax is explicit caller input rather than a consumer-specific import rewrite, fallback module guess or foreign loader mutation.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains absent-clause output, attribute placement and module-validation limits; separate member comments and paragraphs follow the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocImportTag {
  /** Discriminant tag; always `"JSDocImportTag"`. */
  kind: "JSDocImportTag";

  /** The tag name, e.g. `import`. */
  tagName: Identifier;

  /** Binding clause; omission also suppresses the following `from`. */
  importClause?: ImportClause;

  /** Module syntax, normally a string literal; this broad field is not validated. */
  moduleSpecifier: Expression;

  /** The `with { … }` import attributes, if any. */
  attributes?: ImportAttributes;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
