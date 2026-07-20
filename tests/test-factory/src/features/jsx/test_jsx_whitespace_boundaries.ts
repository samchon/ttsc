import { TestValidator } from "@nestia/e2e";
import factory, { type JsxChild, TsPrinter } from "@ttsc/factory";

import { str } from "../../internal/helpers";
import { jsxChildren } from "../../internal/oracle";

const element = (
  tag: string,
  children: readonly JsxChild[],
  attribute?: string,
): JsxChild =>
  factory.createJsxElement(
    factory.createJsxOpeningElement(
      factory.createIdentifier(tag),
      undefined,
      factory.createJsxAttributes(
        attribute === undefined
          ? []
          : [
              factory.createJsxAttribute(
                factory.createIdentifier(attribute),
                str("someRatherLongAttributeValueHere"),
              ),
            ],
      ),
    ),
    children,
    factory.createJsxClosingElement(factory.createIdentifier(tag)),
  );
const fragment = (children: readonly JsxChild[]): JsxChild =>
  factory.createJsxFragment(
    factory.createJsxOpeningFragment(),
    children,
    factory.createJsxJsxClosingFragment(),
  );
const text = (value: string) => factory.createJsxText(value);
const expression = (name: string) =>
  factory.createJsxExpression(undefined, factory.createIdentifier(name));

/**
 * Verifies the boundary shapes of JSX whitespace stay width-invariant.
 *
 * The failure nests and hides: one long attribute at the top of a tree forces
 * the outer group to break, which used to put every descendant text child on
 * its own line, so whitespace vanished deep inside a subtree that was itself
 * short. These are the shapes where the guard is easiest to get wrong — an
 * element that is nothing but whitespace, text that already contains its own
 * newlines, two text children side by side, an opening tag wider than
 * `printWidth`, and an outer element that breaks over an inner one that fits.
 *
 * 1. Build each boundary shape.
 * 2. Print it at `printWidth` 200, 80, 40 and 10.
 * 3. Assert every width transpiles to the same `children` argument.
 */
export const test_jsx_whitespace_boundaries = (): void => {
  const cases: [string, JsxChild][] = [
    ["whitespace-only element", element("div", [text(" ")])],
    [
      "text carrying its own newlines",
      element("div", [text("firstLineOfTheText\nsecondLineOfTheText")]),
    ],
    [
      "two text children side by side",
      element("div", [text("firstTextChildValue"), text("secondTextChild")]),
    ],
    [
      "nested fragments",
      fragment([
        fragment([
          expression("alphaAlphaAlphaAlpha"),
          text(" "),
          expression("bravoBravoBravoBravo"),
        ]),
      ]),
    ],
    [
      "self-closing child",
      element("div", [
        text("Hello there, "),
        factory.createJsxSelfClosingElement(
          factory.createIdentifier("Avatar"),
          undefined,
          factory.createJsxAttributes([]),
        ),
        text("!"),
      ]),
    ],
    [
      "opening tag alone exceeds the width",
      element(
        "section",
        [text("Hello there, "), expression("visitorName")],
        "className",
      ),
    ],
    [
      "outer breaks while the inner fits",
      element("section", [
        expression("headerContentValue"),
        element("span", [text("Hi "), expression("visitorName")]),
        expression("footerContentValue"),
      ]),
    ],
  ];
  for (const [title, node] of cases) {
    const rendered: string[] = [200, 80, 40, 10].map((printWidth) =>
      jsxChildren(new TsPrinter({ printWidth }).print(node)),
    );
    TestValidator.equals(
      `${title} renders the same at every width`,
      new Set(rendered).size,
      1,
    );
  }
};
