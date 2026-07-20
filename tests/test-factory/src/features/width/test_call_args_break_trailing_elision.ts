import { TestValidator } from "@nestia/e2e";
import factory, { type Node, TsPrinter } from "@ttsc/factory";
import ts from "ts-legacy";

import { id, str } from "../../internal/helpers";
import { printLegacy, structure, syntaxErrorOf } from "../../internal/oracle";

const wide = new TsPrinter({ printWidth: 200 });
const tiny = new TsPrinter({ printWidth: 20 });

/**
 * Verifies a call or `new` argument list ending in an elision parses in both
 * layouts.
 *
 * A trailing `OmittedExpression` prints as nothing, so the list already ends in
 * the separator comma of its last real argument — `f(a, )`, one argument, which
 * is exactly what the legacy printer emits. Adding the width-break comma on top
 * produced `f(a, ,)`, which is a hard syntax error, so the same call printed
 * fine until its arguments grew past `printWidth`. The boundary this pins is
 * that the fix must not leave two commas on separate lines either.
 *
 * 1. Print a call and a `new` whose last argument is an elision, flat and
 *    broken.
 * 2. Assert every layout parses, compiles in V8, and keeps one argument — the
 *    same count the legacy printer's text yields.
 * 3. Assert an argument list ending in a spread still gains its break comma.
 */
export const test_call_args_break_trailing_elision = (): void => {
  const argumentCount = (text: string): number => {
    const file: ts.SourceFile = ts.createSourceFile(
      "case.ts",
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    let count = -1;
    const visit = (node: ts.Node): void => {
      if (count < 0 && (ts.isCallExpression(node) || ts.isNewExpression(node)))
        count = node.arguments?.length ?? -1;
      ts.forEachChild(node, visit);
    };
    visit(file);
    return count;
  };
  const cases: [string, Node, ts.Node][] = [
    [
      "call",
      factory.createExpressionStatement(
        factory.createCallExpression(id("handlerFunctionName"), undefined, [
          str("alphaAlphaAlphaAlphaAlpha"),
          factory.createOmittedExpression(),
        ]),
      ),
      ts.factory.createExpressionStatement(
        ts.factory.createCallExpression(
          ts.factory.createIdentifier("handlerFunctionName"),
          undefined,
          [
            ts.factory.createStringLiteral("alphaAlphaAlphaAlphaAlpha"),
            ts.factory.createOmittedExpression(),
          ],
        ),
      ),
    ],
    [
      "new",
      factory.createExpressionStatement(
        factory.createNewExpression(id("HandlerConstructorName"), undefined, [
          str("alphaAlphaAlphaAlpha"),
          factory.createOmittedExpression(),
        ]),
      ),
      ts.factory.createExpressionStatement(
        ts.factory.createNewExpression(
          ts.factory.createIdentifier("HandlerConstructorName"),
          undefined,
          [
            ts.factory.createStringLiteral("alphaAlphaAlphaAlpha"),
            ts.factory.createOmittedExpression(),
          ],
        ),
      ),
    ],
  ];
  for (const [title, node, oracle] of cases) {
    const flat: string = wide.print(node);
    const broken: string = tiny.print(node);
    const expected: string = printLegacy(oracle);
    TestValidator.equals(`${title} broken layout breaks`, broken.includes("\n"), true);
    for (const [layout, text] of [
      ["flat", flat],
      ["broken", broken],
    ] as const) {
      TestValidator.equals(
        `${title} ${layout} compiles`,
        syntaxErrorOf(text),
        undefined,
      );
      TestValidator.equals(
        `${title} ${layout} argument count`,
        argumentCount(text),
        argumentCount(expected),
      );
      TestValidator.equals(
        `${title} ${layout} means what the oracle means`,
        structure(text),
        structure(expected),
      );
    }
    TestValidator.equals(
      `${title} broken has no doubled comma`,
      /,\s*,/.test(broken),
      false,
    );
  }

  // negative twin: a trailing spread keeps the break comma, which is legal
  const spread: string = tiny.print(
    factory.createExpressionStatement(
      factory.createCallExpression(id("handlerFunctionName"), undefined, [
        id("firstArgumentName"),
        factory.createSpreadElement(id("remainingArgumentNames")),
      ]),
    ),
  );
  TestValidator.equals(
    "trailing spread keeps its comma",
    spread.includes("...remainingArgumentNames,"),
    true,
  );
  TestValidator.equals("trailing spread compiles", syntaxErrorOf(spread), undefined);
};
