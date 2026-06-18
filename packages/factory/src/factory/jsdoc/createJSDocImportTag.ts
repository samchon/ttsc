import type {
  Expression,
  Identifier,
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
 * With the default tag name, a named import clause for `Foo`, and a `"./mod"`
 * module specifier, the printer emits:
 *
 * ```ts
 * @import { Foo } from "./mod"
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `import`.
 * @param importClause The import clause, if any.
 * @param moduleSpecifier The module specifier.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocImportTag}.
 */
export const createJSDocImportTag = (
  tagName: Identifier | undefined,
  importClause: ImportClause | undefined,
  moduleSpecifier: Expression,
  comment?: string | readonly JSDocComment[],
): JSDocImportTag =>
  make("JSDocImportTag", {
    tagName: tagName ?? createIdentifier("import"),
    importClause,
    moduleSpecifier,
    comment,
  });
