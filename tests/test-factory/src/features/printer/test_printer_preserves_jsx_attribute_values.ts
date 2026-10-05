import assert from "node:assert/strict";
import ts from "ts-legacy";

import factory, {
  SyntaxKind,
  TsPrinter,
  addSyntheticLeadingComment,
  addSyntheticTrailingComment,
} from "../../../../../packages/factory/src/index";
import { parseClean } from "../../internal/oracle";

/**
 * Verifies JSX attribute strings preserve their supplied UTF-16 values.
 *
 * JSX quoted text decodes entities but does not decode JavaScript backslash
 * escapes. Reusing ordinary string escaping can therefore break parsing or
 * change a prop even when the same string works inside a JSX expression. A lone
 * surrogate needs that expression form for native decoding; valid pairs must
 * remain unchanged, including when adjacent to an unpaired unit.
 *
 * 1. Build literal and expression attributes for punctuation, entities, line
 *    endings, controls, separators and paired or unpaired surrogates.
 * 2. Print both quote styles at narrow and wide widths, then round-trip UTF-8.
 * 3. Parse and transpile with the independent TypeScript compiler and evaluate its
 *    JSX call, comparing the prop and ordinary string to the original value.
 *
 * @evidence contracts/testing.md#behavioral-verification TsPrinter source output must parse and pass each exact input string to the JSX runtime after UTF-8 encoding; ordinary string and expression attributes remain controls.
 * @evidence contracts/testing.md#independent-expectations Original fixture code units supply expected values; the pinned legacy TypeScript parser and transpiler plus V8 interpret output independently of the factory printer.
 * @evidence contracts/testing.md#distinguishing-cases 62 string values (punctuation, entities, line endings, all 32 C0 controls, DEL, LS/PS, lone and paired surrogates, reversed and repeated surrogate units, pairs beside lone units) are each printed with both quote styles at widths 1 and 200 as a plain attribute, an expression attribute and an ordinary string, 744 round-trip checks in total. A separate nested case with a bare attribute and leading/trailing comments on a lone-surrogate attribute, plus a valid pair that must stay a plain attribute literal, distinguishes unnecessary or missing expression conversion.
 * @evidence contracts/testing.md#execution-ownership Factory source-unit discovery owns this exported test and all labeled rows; source imports, in-process compiler calls and V8 evaluation require no native build, installation or product host.
 */
export const test_printer_preserves_jsx_attribute_values = (): void => {
  const cases: [string, string][] = [
    ["empty", ""],
    ["plain", "plain text"],
    ["double quote", 'say "hello"'],
    ["single quote", "it's text"],
    ["both quotes", `"'`],
    ["ampersand", "a&b"],
    ["named entity text", "&quot;&amp;&apos;"],
    ["numeric entity text", "&#13;&#x2028;"],
    ["unknown entity text", "&unknown;"],
    ["backslash", 'a\\b\\n\\"'],
    ["markup", "<tag>{text}>"],
    ["CRLF", "a\r\nb"],
    ["CR", "a\rb"],
    ["LF", "a\nb"],
    ["LS", "a\u2028b"],
    ["PS", "a\u2029b"],
    ["DEL", "a\x7fb"],
    ["high surrogate start", "a\ud800b"],
    ["high surrogate end", "a\udbffb"],
    ["low surrogate start", "a\udc00b"],
    ["low surrogate end", "a\udfffb"],
    ["astral pair", "a\u{1f600}b"],
    ...Array.from({ length: 32 }, (_, code): [string, string] => [
      `C0 ${code}`,
      `a${String.fromCharCode(code)}b`,
    ]),
    ["first valid pair", "\ud800\udc00"],
    ["last valid pair", "\udbff\udfff"],
    ["reversed pair", "\udc00\ud800"],
    ["two high units", "\ud800\udbff"],
    ["two low units", "\udc00\udfff"],
    ["pair then lone high", "\ud800\udc00\udbff"],
    ["lone low then pair", "\udfff\udbff\udfff"],
    ["combined lone payload", '\0\r\n\u2028\ud800&quot;\\n"'],
  ];
  const failures: string[] = [];
  for (const [name, value] of cases)
    for (const singleQuote of [false, true])
      for (const printWidth of [1, 200]) {
        const printer = new TsPrinter({ printWidth });
        const literal = factory.createStringLiteral(value, singleQuote);
        for (const expression of [false, true]) {
          const title = `${name}, singleQuote=${singleQuote}, width=${printWidth}, expression=${expression}`;
          try {
            const node = factory.createJsxSelfClosingElement(
              factory.createIdentifier("div"),
              undefined,
              factory.createJsxAttributes([
                factory.createJsxAttribute(
                  factory.createIdentifier("value"),
                  expression
                    ? factory.createJsxExpression(undefined, literal)
                    : literal,
                ),
              ]),
            );
            const source = Buffer.from(printer.print(node), "utf8").toString(
              "utf8",
            );
            parseClean(source, ts.ScriptKind.TSX);
            const output = ts.transpileModule(`const result = ${source};`, {
              fileName: "attribute.tsx",
              compilerOptions: {
                jsx: ts.JsxEmit.React,
                jsxFactory: "jsx",
                target: ts.ScriptTarget.ESNext,
              },
              reportDiagnostics: true,
            });
            assert.deepEqual(output.diagnostics ?? [], [], title);
            parseClean(output.outputText, ts.ScriptKind.JS);
            const actual: unknown = new Function(
              "jsx",
              `${output.outputText}\nreturn result;`,
            )((_tag: unknown, props: { value: string }) => props.value);
            assert.equal(actual, value, title);
          } catch (error) {
            failures.push(`${title}: ${String(error)}`);
          }
        }
        try {
          const source = Buffer.from(printer.print(literal), "utf8").toString(
            "utf8",
          );
          assert.equal(new Function(`return (${source});`)(), value);
        } catch (error) {
          failures.push(`${name}, ordinary string: ${String(error)}`);
        }
      }
  for (const printWidth of [1, 200]) {
    try {
      const literal = factory.createStringLiteral("\ud800");
      addSyntheticLeadingComment(
        literal,
        SyntaxKind.SingleLineCommentTrivia,
        " leading value",
        true,
      );
      addSyntheticTrailingComment(
        literal,
        SyntaxKind.SingleLineCommentTrivia,
        " trailing value",
        true,
      );
      const child = factory.createJsxElement(
        factory.createJsxOpeningElement(
          factory.createIdentifier("div"),
          undefined,
          factory.createJsxAttributes([
            factory.createJsxAttribute(
              factory.createIdentifier("bare"),
              undefined,
            ),
            factory.createJsxAttribute(
              factory.createIdentifier("value"),
              literal,
            ),
          ]),
        ),
        [],
        factory.createJsxClosingElement(factory.createIdentifier("div")),
      );
      const node = factory.createJsxFragment(
        factory.createJsxOpeningFragment(),
        [child],
        factory.createJsxJsxClosingFragment(),
      );
      const source = Buffer.from(
        new TsPrinter({ printWidth }).print(node),
        "utf8",
      ).toString("utf8");
      const parsed = parseClean(source, ts.ScriptKind.TSX);
      let observed = 0;
      const visit = (node: ts.Node): void => {
        if (ts.isJsxAttribute(node)) {
          if (node.name.getText(parsed) === "bare")
            assert.equal(node.initializer, undefined);
          else {
            assert.ok(node.initializer && ts.isJsxExpression(node.initializer));
            assert.ok(
              node.initializer.expression &&
                ts.isStringLiteral(node.initializer.expression),
            );
            assert.equal(node.initializer.expression.text, "\ud800");
          }
          ++observed;
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed);
      assert.equal(observed, 2);
      assert.ok(source.includes("// leading value"));
      assert.ok(source.includes("// trailing value"));
      const pair = factory.createJsxAttribute(
        factory.createIdentifier("value"),
        factory.createStringLiteral("\ud800\udc00"),
      );
      assert.equal(
        new TsPrinter({ printWidth }).print(pair),
        'value="\ud800\udc00"',
      );
    } catch (error) {
      failures.push(
        `nested comments and bare attribute, width=${printWidth}: ${String(error)}`,
      );
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
};
