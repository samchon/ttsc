import type {
  Expression,
  Identifier,
  ImportAttributes,
  ImportClause,
  JSDocComment,
  JSDocImportTag,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocImportTag}: an `@import` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `import` when omitted. The
 * `importClause` names the bindings to bring in, the `moduleSpecifier` is the
 * source module, and `comment` is the trailing description. The printer mirrors
 * an ordinary import statement after the tag name.
 *
 * Omitting the clause suppresses `from`. The module operand is broadly typed
 * as Expression, so the caller must supply valid module syntax; construction
 * does not resolve it.
 *
 * Comment fragments and child nodes are retained rather
 * than copied, and this builder accepts fragment arrays rather than strings.
 *
 * With the default tag name, a named import clause for `Foo`, and a `"./mod"`
 * module specifier, the printer emits:
 *
 * ```ts
 * @import { Foo } from "./mod"
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The adapter retains bindings, module expression, attributes and comment fragments, defaulting only the absent identifier to import; broad module expressions are not resolved or contextually validated.
 * @evidence contracts/common.md#clear-and-simple-design Existing import-clause and attribute nodes own their syntax, while this constructor exposes one direct mapping to the tag payload without loader state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Import is the documented annotation default rather than a known-module fallback, and no foreign loader or resolver is changed.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains omitted-clause output, caller-owned module validity and fragment-array ownership with an import example; separate paragraphs and parameter tags follow the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `import`.
 * @param importClause The import clause, if any.
 * @param moduleSpecifier The module specifier.
 * @param attributes The `with { … }` import attributes, if any.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocImportTag}.
 */
export const createJSDocImportTag = (
  tagName: Identifier | undefined,
  importClause: ImportClause | undefined,
  moduleSpecifier: Expression,
  attributes?: ImportAttributes,
  comment?: readonly JSDocComment[],
): JSDocImportTag =>
  make("JSDocImportTag", {
    tagName: tagName ?? createIdentifier("import"),
    importClause,
    moduleSpecifier,
    attributes,
    comment,
  });
