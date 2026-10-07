import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, {
  type JSDocTag,
  SyntaxKind,
} from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";
import { parseClean } from "../../internal/oracle";

const f = factory;
const type = (kind: SyntaxKind) =>
  f.createJSDocTypeExpression(f.createKeywordTypeNode(kind));
const property = (name: string, kind: SyntaxKind) =>
  f.createJSDocPropertyTag(undefined, id(name), false, type(kind), false);

/**
 * The tag kind names the legacy parser reads from a block placed before `var
 * x;`.
 */
const parsedTags = (block: string): string[] => {
  const file: ts.SourceFile = parseClean(`${block}\nvar x;`);
  const statement = file.statements[0] as ts.Node & {
    jsDoc?: ts.JSDoc[];
  };
  return (statement.jsDoc?.[0]?.tags ?? []).map(
    (tag) => ts.SyntaxKind[tag.kind]!,
  );
};

/**
 * Verifies the JSDoc builders for typedef type literals, summary-less blocks
 * and the type, property, private, protected and overload tags print the
 * documented lines and parse as those tags.
 *
 * A `@typedef` whose type is an object shape prints `{Object}` and one `@prop`
 * line per property, `{Object[]}` when the shape describes an array, and a
 * block without a summary starts directly with its first tag line. Visibility
 * tags print bare or with a trailing comment, and a bracketed property marks
 * the name optional.
 *
 * 1. Print a typedef over a two-property literal, an array literal and a block
 *    without a summary beside a block with one.
 * 2. Print the type, private, protected, property and overload tags.
 * 3. Compare each block with an authored literal and with the tag kinds the pinned
 *    legacy parser reads from it.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints each block with TsPrinter and requires the exact authored text, detecting wrong tag spelling or stray summary lines; independent parser checks additionally require the specified top-level tag kinds.
 * @evidence contracts/testing.md#independent-expectations Authored literals specify `@typedef {Object} P` followed by property lines, `{Object[]}` for an array shape, `[n]` for an optional property and one tag per line. The independent legacy parse verifies top-level typedef/type/visibility kinds. Property lines are checked by exact text; the standalone property and overload blocks are required only to parse cleanly.
 * @evidence contracts/testing.md#distinguishing-cases A two-property typedef and an array typedef differ in `{Object}` against `{Object[]}`; the summary and summary-less blocks differ in their first line; bracketed and plain property tags differ in the optional marker; bare and commented visibility tags differ in a trailing description.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry that builds the tags with the factory builders and prints them in process; the legacy parser is only the grammar reference and no compiler or process runs. The `@overload` tag name and parameter layout are documented printer behavior, so that block is checked for its exact text and for parsing cleanly.
 */
export const test_jsdoc_typedef_literals_summaryless_blocks_and_visibility_tags =
  (): void => {
    const typedef = (
      shape: ReturnType<typeof f.createJSDocTypeLiteral>,
      name: string,
    ) => f.createJSDocTypedefTag(undefined, shape, id(name));
    const cases: {
      name: string;
      block: string;
      kinds?: string[];
      text: string;
    }[] = [
      {
        name: "typedef over an object literal under a summary",
        block: print(
          f.createJSDocComment("Shape.", [
            typedef(
              f.createJSDocTypeLiteral([
                property("a", SyntaxKind.StringKeyword),
                property("b", SyntaxKind.NumberKeyword),
              ]),
              "P",
            ),
          ]),
        ),
        text: "/**\n * Shape.\n * @typedef {Object} P\n * @prop {string} a\n * @prop {number} b\n */",
        kinds: ["JSDocTypedefTag"],
      },
      {
        name: "typedef over an array literal",
        block: print(
          f.createJSDocComment(undefined, [
            typedef(
              f.createJSDocTypeLiteral(
                [property("a", SyntaxKind.StringKeyword)],
                true,
              ),
              "Q",
            ),
          ]),
        ),
        text: "/**\n * @typedef {Object[]} Q\n * @prop {string} a\n */",
        kinds: ["JSDocTypedefTag"],
      },
      {
        name: "type tag without a summary",
        block: print(
          f.createJSDocComment(undefined, [
            f.createJSDocTypeTag(undefined, type(SyntaxKind.NumberKeyword)),
          ]),
        ),
        text: "/**\n * @type {number}\n */",
        kinds: ["JSDocTypeTag"],
      },
      {
        name: "type tag under a summary",
        block: print(
          f.createJSDocComment("S", [
            f.createJSDocTypeTag(undefined, type(SyntaxKind.NumberKeyword)),
          ]),
        ),
        text: "/**\n * S\n * @type {number}\n */",
        kinds: ["JSDocTypeTag"],
      },
      {
        name: "bare private and commented protected tags",
        block: print(
          f.createJSDocComment(undefined, [
            f.createJSDocPrivateTag(undefined),
            f.createJSDocProtectedTag(undefined, "who"),
          ]),
        ),
        text: "/**\n * @private\n * @protected who\n */",
        kinds: ["JSDocPrivateTag", "JSDocProtectedTag"],
      },
      {
        name: "bracketed property tag with a description",
        block: print(
          f.createJSDocComment(undefined, [
            f.createJSDocPropertyTag(
              undefined,
              id("n"),
              true,
              type(SyntaxKind.StringKeyword),
              false,
              "the n",
            ),
          ]),
        ),
        text: "/**\n * @prop {string} [n] the n\n */",
      },
    ];
    for (const c of cases) {
      TestValidator.equals(c.name, c.block, c.text);
      if (c.kinds !== undefined)
        TestValidator.equals(
          `${c.name}: legacy tag kinds`,
          parsedTags(c.text),
          c.kinds,
        );
      else
        parseClean(`${c.text}
var x;`);
    }

    const overload: JSDocTag = f.createJSDocOverloadTag(
      undefined,
      f.createJSDocSignature(
        undefined,
        [
          f.createJSDocParameterTag(
            undefined,
            id("x"),
            false,
            type(SyntaxKind.NumberKeyword),
            false,
          ),
        ],
        f.createJSDocReturnTag(
          undefined,
          type(SyntaxKind.VoidKeyword),
          undefined,
        ),
      ),
    );
    const overloadText: string = print(
      f.createJSDocComment(undefined, [overload]),
    );
    TestValidator.equals(
      "overload tag with its signature lines",
      overloadText,
      "/**\n * @overload\n * @param {number} x\n * @returns {void}\n */",
    );
    parseClean(`${overloadText}\nvar x;`);

    TestValidator.equals(
      "a standalone type literal prints its property lines",
      print(
        f.createJSDocTypeLiteral([property("a", SyntaxKind.StringKeyword)]),
      ),
      "@prop {string} a",
    );
  };
