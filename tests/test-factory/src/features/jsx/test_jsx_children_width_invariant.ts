import { TestValidator } from "@nestia/e2e";
import factory, { type JsxChild, TsPrinter } from "@ttsc/factory";

import { jsxChildren } from "../../internal/oracle";

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
const fragmentChild = (children: readonly JsxChild[]): JsxChild =>
  factory.createJsxFragment(
    factory.createJsxOpeningFragment(),
    children,
    factory.createJsxJsxClosingFragment(),
  );

const text = (value: string) => factory.createJsxText(value);
const expression = (name: string) =>
  factory.createJsxExpression(undefined, factory.createIdentifier(name));

/**
 * Verifies JSX children transpile to the same `children` argument at every
 * `printWidth`.
 *
 * `printWidth` chooses a layout; it must never change the program. For JSX it
 * did: children were joined with a break-capable separator, and once the group
 * broke, JSX deleted every whitespace-only child that had gained a newline and
 * trimmed the significant edge space off the rest. `<div>Hello there,
 * {name}!</div>` rendered as `Hello there,NAME!` at width 40 and correctly at
 * width 200, so the defect appeared and disappeared as unrelated content
 * changed length. The observable here is the transpiled `children` argument —
 * what the JSX runtime is actually handed — not the printed characters, since
 * the whole point is that the characters are allowed to move.
 *
 * 1. Build the four whitespace-carrying shapes: text before an expression, a
 *    whitespace-only separator between two expressions in an element and in a
 *    fragment, and text on both sides of an expression.
 * 2. Print each at `printWidth` 200, 80, 40 and 10 and transpile every layout.
 * 3. Assert all four widths yield one and the same `children` argument.
 */
export const test_jsx_children_width_invariant = (): void => {
  const cases: [string, JsxChild][] = [
    [
      "text before an expression",
      element([
        text("aaaaaaaaaaaaaaaaaaaa "),
        expression("bbbbbbbbbbbbbbbbbbbb"),
      ]),
    ],
    [
      "whitespace-only separator",
      element([
        expression("alphaAlphaAlphaAlpha"),
        text(" "),
        expression("bravoBravoBravoBravo"),
      ]),
    ],
    [
      "whitespace-only separator in a fragment",
      fragmentChild([
        expression("alphaAlphaAlphaAlpha"),
        text(" "),
        expression("bravoBravoBravoBravo"),
      ]),
    ],
    [
      "text on both sides of an expression",
      element([
        text("Hello there, "),
        expression("nameOfTheCurrentlySignedInVisitor"),
        text("!"),
      ]),
    ],
    [
      "a fragment nested in an element",
      element([
        fragmentChild([
          expression("alphaAlphaAlphaAlpha"),
          text(" "),
          expression("bravoBravoBravoBravo"),
        ]),
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
