import { TestValidator } from "@nestia/e2e";
import factory, { type JsxChild, SyntaxKind, TsPrinter } from "@ttsc/factory";

import { id, str } from "../../internal/helpers";
import { jsxChildren } from "../../internal/oracle";

const tiny = new TsPrinter({ printWidth: 40 });

const element = (children: readonly JsxChild[]): JsxChild =>
  factory.createJsxElement(
    factory.createJsxOpeningElement(
      factory.createIdentifier("div"),
      undefined,
      factory.createJsxAttributes([]),
    ),
    children,
    factory.createJsxClosingElement(factory.createIdentifier("div")),
  );
const expression = (name: string) =>
  factory.createJsxExpression(undefined, factory.createIdentifier(name));

/**
 * Verifies the JSX whitespace guard is scoped: children with nothing to lose
 * still break, and ordinary code still has its trailing whitespace trimmed.
 *
 * The guard that keeps `printWidth` from editing JSX text must not turn into a
 * blanket refusal to lay JSX out, and the raw-text exemption that keeps a
 * trailing space alive must not leak into generated code, where a line ending
 * in spaces is noise. These are the two over-match twins of the fix: an element
 * whose children carry no whitespace at all, and a broken argument list, object
 * literal and binary expression in plain TypeScript.
 *
 * 1. Print `<div>{a}{b}</div>` narrow and assert it breaks onto separate lines,
 *    gains no `{" "}`, and still transpiles to the same two children.
 * 2. Emit a `JsxText` immediately before a hard line break and assert its trailing
 *    space survives, which is the raw-text exemption itself.
 * 3. Print a narrow call, object literal and binary expression.
 * 4. Assert no line of that output ends in a space or tab.
 */
export const test_jsx_break_without_text_children = (): void => {
  const printed: string = tiny.print(
    element([
      expression("alphaAlphaAlphaAlphaAlpha"),
      expression("bravoBravoBravoBravoBravo"),
    ]),
  );
  TestValidator.equals("breaks freely", printed.includes("\n"), true);
  TestValidator.equals(
    "gains no explicit space child",
    printed.includes('{" "}'),
    false,
  );
  TestValidator.equals(
    "children survive the break",
    jsxChildren(printed),
    jsxChildren(
      new TsPrinter({ printWidth: 200 }).print(
        element([
          expression("alphaAlphaAlphaAlphaAlpha"),
          expression("bravoBravoBravoBravoBravo"),
        ]),
      ),
    ),
  );

  // the raw-text exemption: the layout engine trims a line's trailing spaces
  // before writing a newline, which would silently edit JSX text content
  TestValidator.equals(
    "raw JSX text keeps its trailing space across a line break",
    new TsPrinter().printNodes([
      factory.createJsxText("Hello there, "),
      factory.createJsxText("!"),
    ]),
    "Hello there, \n!",
  );

  const code: string[] = [
    tiny.print(
      factory.createExpressionStatement(
        factory.createCallExpression(id("handlerFunctionName"), undefined, [
          str("alphaAlphaAlphaAlpha"),
          str("bravoBravoBravoBravo"),
        ]),
      ),
    ),
    tiny.print(
      factory.createExpressionStatement(
        factory.createParenthesizedExpression(
          factory.createObjectLiteralExpression([
            factory.createPropertyAssignment("firstPropertyName", str("alpha")),
            factory.createPropertyAssignment(
              "secondPropertyName",
              str("bravo"),
            ),
          ]),
        ),
      ),
    ),
    tiny.print(
      factory.createExpressionStatement(
        factory.createBinaryExpression(
          id("firstOperandName"),
          SyntaxKind.PlusToken,
          id("secondOperandName"),
        ),
      ),
    ),
  ];
  for (const text of code)
    TestValidator.equals(
      "no line ends in whitespace",
      text.split("\n").filter((line) => /[ \t]$/.test(line)),
      [],
    );
};
