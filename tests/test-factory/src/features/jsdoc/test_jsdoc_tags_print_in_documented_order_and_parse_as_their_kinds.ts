import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, kw, print } from "../../internal/helpers";

/**
 * Verifies the JSDoc block builders print each tag in the documented layout and
 * that the legacy parser reads every printed tag back as the intended kind.
 *
 * A block prints a summary line followed by one ` * @tag` line per tag. The
 * printed text is checked against an authored literal, and then re-parsed by
 * the pinned legacy compiler so the literal is not the only witness: a tag that
 * prints plausibly but parses as another kind fails.
 *
 * 1. Build a block with param (typed, bracketed), returns, template, author,
 *    deprecated, a custom tag, and the flag tags public, readonly and
 *    override.
 * 2. Compare the printed block with the authored literal.
 * 3. Parse the block above a function and compare the tag kinds and names.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints a JSDoc block built from createJSDocComment and tag builders and re-parses it with the legacy compiler, comparing the full text and the (kind, tag name) list.
 * @evidence contracts/testing.md#independent-expectations The expected block is an authored literal following the documented ` * @tag {type} name comment` layout; the kind list is produced by the pinned legacy parser, not by the factory.
 * @evidence contracts/testing.md#distinguishing-cases A required and a bracketed parameter contrast, typed returns contrasts with the type-less flag tags, and a custom tag contrasts with the known kinds.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers this entry; it calls the factory builders and TsPrinter.print, and ts-legacy parses the text in process.
 */
export const test_jsdoc_tags_print_in_documented_order_and_parse_as_their_kinds =
  (): void => {
    const type = (kind: SyntaxKind) =>
      factory.createJSDocTypeExpression(kw(kind));
    const block = factory.createJSDocComment("Summary line.", [
      factory.createJSDocParameterTag(
        undefined,
        id("value"),
        false,
        type(SyntaxKind.StringKeyword),
        false,
        "the value",
      ),
      factory.createJSDocParameterTag(
        undefined,
        id("opt"),
        true,
        type(SyntaxKind.NumberKeyword),
        false,
        "optional",
      ),
      factory.createJSDocReturnTag(
        undefined,
        type(SyntaxKind.StringKeyword),
        "result",
      ),
      factory.createJSDocTemplateTag(undefined, undefined, [
        factory.createTypeParameterDeclaration(
          undefined,
          "T",
          undefined,
          undefined,
        ),
      ]),
      factory.createJSDocAuthorTag(undefined, "Someone"),
      factory.createJSDocDeprecatedTag(undefined, "use g"),
      factory.createJSDocUnknownTag(id("custom"), "text"),
      factory.createJSDocPublicTag(undefined),
      factory.createJSDocReadonlyTag(undefined),
      factory.createJSDocOverrideTag(undefined),
    ]);
    const text = print(block);
    TestValidator.equals(
      "block text",
      text,
      [
        "/**",
        " * Summary line.",
        " * @param {string} value the value",
        " * @param {number} [opt] optional",
        " * @returns {string} result",
        " * @template T",
        " * @author Someone",
        " * @deprecated use g",
        " * @custom text",
        " * @public",
        " * @readonly",
        " * @override",
        " */",
      ].join("\n"),
    );

    const file = ts.createSourceFile(
      "a.ts",
      `${text}\nfunction f<T>(value, opt) {}`,
      ts.ScriptTarget.Latest,
      true,
    );
    const tags = ts
      .getJSDocTags(file.statements[0]!)
      .map((tag) => `${ts.SyntaxKind[tag.kind]}:${tag.tagName.text}`);
    TestValidator.equals("parsed tags", tags, [
      "JSDocParameterTag:param",
      "JSDocParameterTag:param",
      "JSDocReturnTag:returns",
      "JSDocTemplateTag:template",
      "JSDocAuthorTag:author",
      "JSDocDeprecatedTag:deprecated",
      "FirstJSDocTagNode:custom",
      "JSDocPublicTag:public",
      "JSDocReadonlyTag:readonly",
      "JSDocOverrideTag:override",
    ]);
  };
