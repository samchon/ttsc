import assert from "node:assert/strict";
import ts from "ts-legacy";

import factory, {
  type ArrayBindingPattern,
  type Node,
  NodeFlags,
  TsPrinter,
} from "../../../../../packages/factory/src/index";
import { id } from "../../internal/helpers";
import { parseClean } from "../../internal/oracle";

/**
 * Verifies array-binding elisions preserve iterator advancement and abrupt
 * completion.
 *
 * A hole binds no name but still consumes an iterator step. Comparing only
 * named bindings lets a printer delete observable next calls and exceptions.
 *
 * 1. Print lone, repeated, named and nested holes through binding consumers at two
 *    widths.
 * 2. Execute each source against fresh iterators and compare authored next/return
 *    traces.
 * 3. Exhaust or throw on the second next call and require correct closing or
 *    failure.
 * 4. Check the for-in binding's complete parsed shape without modifying intrinsic
 *    iterators.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs actual TsPrinter output in V8 through declarations, parameters, nested bindings, classic-for initialization, for-of, catch and assignment control. Exact next/return traces and thrown-error identity distinguish deleted holes, extra advances and incorrect iterator closing; for-in compares its complete binding-element shape.
 * @evidence contracts/testing.md#independent-expectations ECMAScript destructuring elision performs IteratorStep even without assigning a name and closes an unfinished iterator after successful binding. A next call that throws propagates without return. Authored traces encode those rules independently of factory output; the separate legacy parser compares authored for-in kind names and holes.
 * @evidence contracts/testing.md#distinguishing-cases Width200/width1, lone/two/named/nested holes, six binding consumers, an assignment-target control and a no-hole control distinguish preservation from blanket comma insertion. Throwing at the second step makes loss of a trailing hole observable as a missed failure; returning done there requires no iterator return, with fresh state per row.
 * @evidence contracts/testing.md#execution-ownership The matching TestExecutor feature runs owning source factory/printer APIs and V8 evaluation in one Node process. Each labeled row executes even when another fails and aggregate errors retain its identity; no consumer installation, native build or product process executes.
 */
export const test_array_binding_elisions_preserve_iterator_effects =
  (): void => {
    const hole = () => factory.createOmittedExpression();
    const named = () =>
      factory.createBindingElement(undefined, undefined, "first");
    const pattern = () => factory.createArrayBindingPattern([named(), hole()]);
    const declaration = (binding: ArrayBindingPattern) =>
      factory.createVariableDeclaration(
        binding,
        undefined,
        undefined,
        id("values"),
      );
    const declarations = (binding: ArrayBindingPattern) =>
      factory.createVariableDeclarationList(
        [declaration(binding)],
        NodeFlags.Const,
      );
    const statement = (binding: ArrayBindingPattern) =>
      factory.createVariableStatement(undefined, declarations(binding));
    const rows: {
      name: string;
      node: Node;
      steps: number;
      nested?: boolean;
    }[] = [
      {
        name: "lone hole",
        node: statement(factory.createArrayBindingPattern([hole()])),
        steps: 1,
      },
      {
        name: "two holes",
        node: statement(factory.createArrayBindingPattern([hole(), hole()])),
        steps: 2,
      },
      { name: "named trailing hole", node: statement(pattern()), steps: 2 },
      {
        name: "no hole control",
        node: statement(factory.createArrayBindingPattern([named()])),
        steps: 1,
      },
      {
        name: "nested trailing holes",
        node: statement(
          factory.createArrayBindingPattern([
            factory.createBindingElement(undefined, undefined, pattern()),
            hole(),
          ]),
        ),
        steps: 2,
        nested: true,
      },
      {
        name: "function parameter",
        node: factory.createExpressionStatement(
          factory.createCallExpression(
            factory.createParenthesizedExpression(
              factory.createFunctionExpression(
                undefined,
                undefined,
                undefined,
                undefined,
                [
                  factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    pattern(),
                  ),
                ],
                undefined,
                factory.createBlock([]),
              ),
            ),
            undefined,
            [id("values")],
          ),
        ),
        steps: 2,
      },
      {
        name: "classic for",
        node: factory.createForStatement(
          declarations(pattern()),
          factory.createFalse(),
          undefined,
          factory.createBlock([]),
        ),
        steps: 2,
      },
      {
        name: "for of",
        node: factory.createForOfStatement(
          undefined,
          factory.createVariableDeclarationList(
            [factory.createVariableDeclaration(pattern())],
            NodeFlags.Const,
          ),
          factory.createArrayLiteralExpression([id("values")]),
          factory.createBlock([]),
        ),
        steps: 2,
      },
      {
        name: "catch binding",
        node: factory.createTryStatement(
          factory.createBlock([factory.createThrowStatement(id("values"))]),
          factory.createCatchClause(
            factory.createVariableDeclaration(pattern()),
            factory.createBlock([]),
          ),
          undefined,
        ),
        steps: 2,
      },
      {
        name: "assignment control",
        node: factory.createExpressionStatement(
          factory.createAssignment(
            factory.createArrayLiteralExpression([id("first"), hole()]),
            id("values"),
          ),
        ),
        steps: 2,
      },
    ];
    const failures: Error[] = [];
    for (const width of [200, 1]) {
      const printer = new TsPrinter({ printWidth: width });
      for (const row of rows) {
        for (const mode of ["success", "throw", "exhausted"] as const) {
          const abrupt = mode === "throw";
          const title = `${row.name}/width${width}/${mode}`;
          try {
            const events: string[] = [];
            const thrown = new Error("second iterator step");
            const iterable = (label: string, first: unknown) => ({
              [Symbol.iterator]() {
                let steps = 0;
                return {
                  next() {
                    events.push(`${label}:next`);
                    if (++steps === 2 && abrupt) throw thrown;
                    return {
                      value: steps === 1 ? first : steps,
                      done: mode === "exhausted" && steps > 1,
                    };
                  },
                  return() {
                    events.push(`${label}:return`);
                    return { done: true };
                  },
                };
              },
            });
            const values = iterable(
              "outer",
              row.nested ? iterable("inner", 10) : 10,
            );
            const source = `${row.name === "assignment control" ? "let first;\n" : ""}${printer.print(row.node)}`;
            if (abrupt && row.steps === 2)
              assert.throws(
                () => new Function("values", source)(values),
                (error) => error === thrown,
              );
            else new Function("values", source)(values);
            const expected = row.nested
              ? abrupt
                ? ["outer:next", "inner:next", "inner:next", "outer:return"]
                : mode === "exhausted"
                  ? ["outer:next", "inner:next", "inner:next", "outer:next"]
                  : [
                      "outer:next",
                      "inner:next",
                      "inner:next",
                      "inner:return",
                      "outer:next",
                      "outer:return",
                    ]
              : [
                  ...Array.from({ length: row.steps }, () => "outer:next"),
                  ...(mode !== "success" && row.steps === 2
                    ? []
                    : ["outer:return"]),
                ];
            assert.deepEqual(events, expected, title);
          } catch (cause) {
            failures.push(new Error(title, { cause }));
          }
        }
      }
      try {
        const node = factory.createForInStatement(
          factory.createVariableDeclarationList(
            [factory.createVariableDeclaration(pattern())],
            NodeFlags.Const,
          ),
          id("keys"),
          factory.createBlock([]),
        );
        const parsed = parseClean(printer.print(node))
          .statements[0] as ts.ForInStatement;
        const binding = (parsed.initializer as ts.VariableDeclarationList)
          .declarations[0]!.name as ts.ArrayBindingPattern;
        assert.deepEqual(
          binding.elements.map((element) =>
            ts.isOmittedExpression(element)
              ? "hole"
              : (element.name as ts.Identifier).text,
          ),
          ["first", "hole"],
        );
      } catch (cause) {
        failures.push(new Error(`for in/width${width}`, { cause }));
      }
    }
    if (failures.length)
      throw new AggregateError(failures, "array binding iterator effects");
  };
