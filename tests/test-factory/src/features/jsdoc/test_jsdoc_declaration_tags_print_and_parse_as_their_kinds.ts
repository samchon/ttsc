import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, kw, print } from "../../internal/helpers";

/**
 * Verifies the declaration-describing JSDoc tags (class, enum, this, satisfies,
 * implements, augments, import, callback and a typedef over a type) print their
 * documented form and parse as the intended tag kinds.
 *
 * Each tag prints `@name`, then its braced type or class where it has one, then
 * its comment. The printed block is re-parsed by the pinned legacy compiler to
 * confirm each line is the tag it claims to be.
 *
 * 1. Build one block holding all nine tags.
 * 2. Compare the printed block with an authored literal.
 * 3. Parse it above a function and compare the tag kinds and names.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints a block holding the nine tags and re-parses it with the legacy compiler, comparing the whole text and the (kind, name) list.
 * @evidence contracts/testing.md#independent-expectations The literal follows the documented `@tag {type} comment` layout (for example `@callback Cb` then its parameter and return lines); kinds come from the pinned legacy parser.
 * @evidence contracts/testing.md#distinguishing-cases Tags with a braced type (enum, this, satisfies), a braced class (implements, augments), a clause (import) and a nested signature (callback) contrast with the bare class tag and the named typedef.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry calling the builders and TsPrinter.print; ts-legacy parses in process. Parameter, returns and template tags are owned by test_jsdoc_tags_print_in_documented_order_and_parse_as_their_kinds.
 */
export const test_jsdoc_declaration_tags_print_and_parse_as_their_kinds =
  (): void => {
    const type = (kind: SyntaxKind) =>
      factory.createJSDocTypeExpression(kw(kind));
    const block = factory.createJSDocComment("S", [
      factory.createJSDocClassTag(undefined, "c"),
      factory.createJSDocEnumTag(undefined, type(SyntaxKind.StringKeyword), "e"),
      factory.createJSDocThisTag(undefined, type(SyntaxKind.ObjectKeyword), "t"),
      factory.createJSDocSatisfiesTag(
        undefined,
        type(SyntaxKind.StringKeyword),
        "s",
      ),
      factory.createJSDocImplementsTag(
        undefined,
        factory.createExpressionWithTypeArguments(id("I"), undefined),
        "i",
      ),
      factory.createJSDocAugmentsTag(
        undefined,
        factory.createExpressionWithTypeArguments(id("B"), undefined),
        "a",
      ),
      factory.createJSDocImportTag(
        undefined,
        factory.createImportClause(
          undefined,
          undefined,
          factory.createNamedImports([
            factory.createImportSpecifier(false, undefined, "A"),
          ]),
        ),
        factory.createStringLiteral("m"),
      ),
      factory.createJSDocCallbackTag(
        undefined,
        factory.createJSDocSignature(
          undefined,
          [
            factory.createJSDocParameterTag(
              undefined,
              id("x"),
              false,
              type(SyntaxKind.StringKeyword),
              false,
              "arg",
            ),
          ],
          factory.createJSDocReturnTag(
            undefined,
            type(SyntaxKind.VoidKeyword),
            undefined,
          ),
        ),
        id("Cb"),
      ),
      factory.createJSDocTypedefTag(
        undefined,
        type(SyntaxKind.StringKeyword),
        id("Alias"),
      ),
    ]);
    const text = print(block);
    TestValidator.equals(
      "block text",
      text,
      [
        "/**",
        " * S",
        " * @class c",
        " * @enum {string} e",
        " * @this {object} t",
        " * @satisfies {string} s",
        " * @implements {I} i",
        " * @augments {B} a",
        ' * @import { A } from "m"',
        " * @callback Cb",
        " * @param {string} x arg",
        " * @returns {void}",
        " * @typedef {string} Alias",
        " */",
      ].join("\n"),
    );

    const file = ts.createSourceFile(
      "a.js",
      `${text}\nfunction f() {}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const kinds = ts
      .getJSDocTags(file.statements[0]!)
      .map(
        (tag) =>
          `${tag.kind === ts.SyntaxKind.JSDocImportTag ? "JSDocImportTag" : ts.SyntaxKind[tag.kind]}:${tag.tagName.text}`,
      );
    TestValidator.equals("parsed tags", kinds, [
      "JSDocClassTag:class",
      "JSDocEnumTag:enum",
      "JSDocThisTag:this",
      "JSDocSatisfiesTag:satisfies",
      "JSDocImplementsTag:implements",
      "JSDocAugmentsTag:augments",
      "JSDocImportTag:import",
      "JSDocCallbackTag:callback",
      "JSDocTypedefTag:typedef",
    ]);
  };
