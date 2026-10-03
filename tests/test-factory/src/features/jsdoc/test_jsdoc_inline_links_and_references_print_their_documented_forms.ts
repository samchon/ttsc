import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, { SyntaxKind } from "../../../../../packages/factory/src/index";
import { id, kw, print } from "../../internal/helpers";

/**
 * Verifies inline JSDoc links, text parts and name references print verbatim and
 * parse back as the intended inline kinds.
 *
 * A link prints its target followed directly by the caller's text, so a label's
 * separating space belongs to the text. Text parts and a member-name reference
 * (`Foo#bar`) follow the same verbatim rule.
 *
 * 1. Build a comment from text parts and link, linkcode and linkplain nodes.
 * 2. Print a `@see` tag with a member-name reference and a text-only link.
 * 3. Re-parse the first block with the legacy compiler and list the inline kinds.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints inline comment parts and a see tag, comparing full text, then parses the first block and compares the inline node kinds.
 * @evidence contracts/testing.md#independent-expectations Expected strings are authored from the documented rule that text follows the name with no inserted separator; inline kinds come from the pinned legacy parser.
 * @evidence contracts/testing.md#distinguishing-cases A labelled link, an unlabelled linkcode, a member-name target and a name-less text-only link contrast, and a typed throws tag contrasts with the link-only comment.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry calling the builders and TsPrinter.print; ts-legacy parses in process.
 */
export const test_jsdoc_inline_links_and_references_print_their_documented_forms =
  (): void => {
    const parts = factory.createJSDocComment([
      factory.createJSDocText("See "),
      factory.createJSDocLink(id("Foo"), " the foo"),
      factory.createJSDocText(" and "),
      factory.createJSDocLinkCode(id("Bar"), ""),
      factory.createJSDocText(" and "),
      factory.createJSDocLinkPlain(id("Baz"), " baz"),
    ]);
    const text = print(parts);
    TestValidator.equals(
      "inline parts",
      text,
      [
        "/**",
        " * See {@link Foo the foo} and {@linkcode Bar} and {@linkplain Baz baz}",
        " */",
      ].join("\n"),
    );

    const file = ts.createSourceFile(
      "a.ts",
      `${text}\nfunction f() {}`,
      ts.ScriptTarget.Latest,
      true,
    );
    const doc = (file.statements[0] as unknown as { jsDoc: ts.JSDoc[] })
      .jsDoc[0]!;
    TestValidator.equals(
      "inline kinds",
      (doc.comment as ts.NodeArray<ts.JSDocComment>).map(
        (part) => ts.SyntaxKind[part.kind],
      ),
      [
        "JSDocText",
        "JSDocLink",
        "JSDocText",
        "JSDocLinkCode",
        "JSDocText",
        "JSDocLinkPlain",
      ],
    );

    TestValidator.equals(
      "see with a member reference",
      print(
        factory.createJSDocComment("S", [
          factory.createJSDocSeeTag(
            undefined,
            factory.createJSDocNameReference(
              factory.createJSDocMemberName(id("Foo"), id("bar")),
            ),
            "see it",
          ),
        ]),
      ),
      ["/**", " * S", " * @see Foo#bar see it", " */"].join("\n"),
    );
    TestValidator.equals(
      "text-only link",
      print(factory.createJSDocLink(undefined, "http://x")),
      "{@link http://x}",
    );
    TestValidator.equals(
      "typed tag contrast",
      print(
        factory.createJSDocComment("S", [
          factory.createJSDocThrowsTag(
            id("throws"),
            factory.createJSDocTypeExpression(kw(SyntaxKind.StringKeyword)),
            "boom",
          ),
        ]),
      ),
      ["/**", " * S", " * @throws {string} boom", " */"].join("\n"),
    );
  };
