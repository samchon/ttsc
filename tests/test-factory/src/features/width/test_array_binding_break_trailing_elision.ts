import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, {
  NodeFlags,
  TsPrinter,
} from "../../../../../packages/factory/src/index";
import { id } from "../../internal/helpers";

/**
 * Verifies a broken array binding pattern ending in an elision parses back with
 * its authored hole in both flat and broken layouts.
 *
 * Pins the `OmittedExpression` branch of `TsPrinter.listTrailingComma`. The
 * comma after a trailing hole is semantic: `[a, ,]` advances an iterator once
 * more than `[a, ]`. Both layouts must retain that authored OmittedExpression,
 * even though it binds no name. The iterator-effects case checks that runtime
 * distinction through each binding consumer.
 *
 * 1. Print `const [first, second, <hole>] = values;` flat and broken.
 * 2. Assert both layouts transpile without syntax diagnostics.
 * 3. Parse both back and require the two named bindings plus the authored hole.
 *
 * @evidence contracts/testing.md#behavioral-verification Flat and broken array bindings ending in an elision retain first, second and the authored hole instead of dropping an iterator advance.
 * @evidence contracts/testing.md#independent-expectations The independent TS parser/transpiler and authored first/second/hole array specify the complete binding shape. ECMAScript elision advances the iterator even without binding a name; the iterator-effects companion checks that observable behavior.
 * @evidence contracts/testing.md#distinguishing-cases Wide80 and narrow20 layouts must differ in line breaks but agree on binding names/arity; literal-array holes are covered separately.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_array_binding_break_trailing_elision. Calls declare, both printers and bindingNames parser/transpiler within this one source unit export.
 */
export const test_array_binding_break_trailing_elision = (): void => {
  const declare = () =>
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createArrayBindingPattern([
              factory.createBindingElement(undefined, undefined, "first"),
              factory.createBindingElement(undefined, undefined, "second"),
              factory.createOmittedExpression(),
            ]),
            undefined,
            undefined,
            id("values"),
          ),
        ],
        NodeFlags.Const,
      ),
    );
  const bindingNames = (text: string): string[] => {
    const source: ts.SourceFile = ts.createSourceFile(
      "case.ts",
      `declare const values: string[];\n${text}\n`,
      ts.ScriptTarget.Latest,
      true,
    );
    const diagnostics: readonly ts.Diagnostic[] =
      ts.transpileModule(source.text, { reportDiagnostics: true })
        .diagnostics ?? [];
    TestValidator.equals("syntax diagnostics", diagnostics.length, 0);
    const statement: ts.Statement = source.statements[1]!;
    if (!ts.isVariableStatement(statement))
      throw new Error("expected a variable statement");
    const pattern: ts.BindingName =
      statement.declarationList.declarations[0]!.name;
    if (!ts.isArrayBindingPattern(pattern))
      throw new Error("expected an array binding pattern");
    return pattern.elements.map((element) =>
      ts.isBindingElement(element) && ts.isIdentifier(element.name)
        ? element.name.text
        : "<hole>",
    );
  };
  const wide: string = new TsPrinter({ printWidth: 80 }).print(declare());
  const broken: string = new TsPrinter({ printWidth: 20 }).print(declare());
  TestValidator.equals("flat stays on one line", wide.includes("\n"), false);
  TestValidator.equals("broken layout breaks", broken.includes("\n"), true);
  TestValidator.equals("flat arity", bindingNames(wide), [
    "first",
    "second",
    "<hole>",
  ]);
  TestValidator.equals("broken arity", bindingNames(broken), [
    "first",
    "second",
    "<hole>",
  ]);
};
