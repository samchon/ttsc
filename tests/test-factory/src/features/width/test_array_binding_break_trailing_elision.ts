import { TestValidator } from "@nestia/e2e";
import factory, { NodeFlags, TsPrinter } from "@ttsc/factory";
import ts from "ts-legacy";

import { id } from "../../internal/helpers";

/**
 * Verifies a broken array binding pattern ending in an elision parses back with
 * the same arity as its flat layout.
 *
 * Pins the `OmittedExpression` branch of `TsPrinter.listTrailingComma`. The
 * synthetic width-break comma must stay cosmetic: after a trailing hole it is
 * not (`[a, ,]` parses to one more hole than `[a, ]`), so the flat and broken
 * layouts of the same node would disagree on arity. The printer suppresses it
 * there, making both layouts parse to the named bindings only — a trailing hole
 * binds nothing, so dropping it is semantically lossless.
 *
 * 1. Print `const [first, second, <hole>] = values;` flat and broken.
 * 2. Assert both layouts transpile without syntax diagnostics.
 * 3. Parse both back and assert each yields exactly the two named binding elements
 *    — identical arity regardless of layout.
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
  TestValidator.equals("flat arity", bindingNames(wide), ["first", "second"]);
  TestValidator.equals("broken arity", bindingNames(broken), [
    "first",
    "second",
  ]);
};
