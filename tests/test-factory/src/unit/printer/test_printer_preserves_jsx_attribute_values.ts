import assert from "node:assert/strict";
import ts from "ts-legacy";

import factory, { TsPrinter } from "../../../../../packages/factory/src/index";
import { parseClean } from "../../internal/oracle";

/**
 * Verifies JSX attribute strings preserve their supplied UTF-16 values.
 *
 * JSX quoted text decodes entities but does not decode JavaScript backslash
 * escapes. Reusing ordinary string escaping can therefore break parsing or
 * change a prop even when the same string works inside a JSX expression.
 *
 * 1. Build literal and expression attributes for punctuation, entities, line
 *    endings, controls, separators and paired or unpaired surrogates.
 * 2. Print both quote styles at narrow and wide widths, then round-trip UTF-8.
 * 3. Parse and transpile with the independent TypeScript compiler and evaluate
 *    its JSX call, comparing the prop and ordinary string to the original value.
 *
 * @evidence contracts/testing.md#behavioral-verification TsPrinter source output must parse and pass each exact input string to the JSX runtime after UTF-8 encoding; ordinary string and expression attributes remain controls.
 * @evidence contracts/testing.md#independent-expectations Original fixture code units supply expected values; the pinned legacy TypeScript parser and transpiler plus V8 interpret output independently of the factory printer.
 * @evidence contracts/testing.md#distinguishing-cases Both quote styles and widths 1/200 cover empty and plain text, quotes, entity-looking ampersands, backslashes, CR/LF/CRLF, every C0 control, DEL, LS/PS, surrogate endpoints and an astral pair for literal and expression attributes.
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
    ["backslash", "a\\b\\n\\\""],
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
  assert.equal(failures.length, 0, failures.join("\n"));
};
