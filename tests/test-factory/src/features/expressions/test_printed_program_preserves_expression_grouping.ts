import assert from "node:assert/strict";

import factory, {
  SyntaxKind,
  TsPrinter,
} from "../../../../../packages/factory/src/index";

/**
 * Verifies printed programs preserve class scope and operand grouping.
 *
 * Equivalent-looking source can move a class name into outer scope or regroup
 * floating-point arithmetic and side-effecting numeric conversions.
 *
 * 1. Build anonymous and named class expression statements through public
 *    builders.
 * 2. Parse each emitted statement and check the named expression introduces no
 *    binding in the enclosing scope.
 * 3. Evaluate separately grouped addition and multiplication with literal expected
 *    results, then compare right and left coercion order for arithmetic and
 *    bitwise operators, collecting all failures before ending the entry.
 *
 * @evidence contracts/testing.md#behavioral-verification Public factory builders feed TsPrinter.print; the actual JavaScript runtime parses class expression statements, checks their enclosing scope, evaluates emitted arithmetic, and records observable operand conversions.
 * @evidence contracts/testing.md#independent-expectations Literal zero and 10000000000000002 follow IEEE754 underflow and rounding for the authored right-associated operands. ECMAScript class-expression names remain local to the expression. Numeric operators convert inner binary operands before the outer left operand, giving the literal b,c,a order for right grouping and a,b,c for left grouping. No legacy printer output supplies an expectation.
 * @evidence contracts/testing.md#distinguishing-cases Anonymous and named class statements distinguish syntax and binding preservation. Right-associated underflow multiplication and precision-sensitive addition contrast left-associated controls. Multiplication and all three bitwise operators contrast right and left grouping with side-effecting valueOf operands.
 * @evidence contracts/testing.md#execution-ownership This discoverable factory source unit runs all fourteen cases in one Node process without compiling a consumer, opening a native host or spawning a process. Each captured assertion retains its case label and all independent cases execute.
 */
export function test_printed_program_preserves_expression_grouping(): void {
  const printer = new TsPrinter();
  const failures: unknown[] = [];
  const check = (label: string, action: () => void): void => {
    try {
      action();
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  for (const name of [undefined, "Named"] as const) {
    check(name ?? "anonymous-class-statement", () => {
      const statement = factory.createExpressionStatement(
        factory.createClassExpression(
          undefined,
          name,
          undefined,
          undefined,
          [],
        ),
      );
      new Function(printer.print(statement))();
      if (name !== undefined)
        assert.equal(
          new Function(`${printer.print(statement)} return typeof Named;`)(),
          "undefined",
        );
    });
  }
  const number = (value: string) => factory.createNumericLiteral(value);
  for (const [label, expression, expected] of [
    [
      "multiply-right-underflow",
      factory.createMultiply(
        number("1e308"),
        factory.createMultiply(number("1e-308"), number("1e-308")),
      ),
      0,
    ],
    [
      "multiply-left-control",
      factory.createMultiply(
        factory.createMultiply(number("1e308"), number("1e-308")),
        number("1e-308"),
      ),
      1e-308,
    ],
    [
      "add-right-rounding",
      factory.createAdd(
        number("1e16"),
        factory.createAdd(number("1"), number("1")),
      ),
      10000000000000002,
    ],
    [
      "add-left-control",
      factory.createAdd(
        factory.createAdd(number("1e16"), number("1")),
        number("1"),
      ),
      10000000000000000,
    ],
  ] as const) {
    check(label, () =>
      assert.equal(
        new Function(`return (${printer.print(expression)});`)(),
        expected,
      ),
    );
  }
  for (const operator of [
    SyntaxKind.AsteriskToken,
    SyntaxKind.BarToken,
    SyntaxKind.AmpersandToken,
    SyntaxKind.CaretToken,
  ]) {
    for (const rightAssociated of [true, false]) {
      check(
        `${operator}-${rightAssociated ? "right" : "left"}-coercions`,
        () => {
          const a = factory.createIdentifier("a");
          const b = factory.createIdentifier("b");
          const c = factory.createIdentifier("c");
          const expression = rightAssociated
            ? factory.createBinaryExpression(
                a,
                operator,
                factory.createBinaryExpression(b, operator, c),
              )
            : factory.createBinaryExpression(
                factory.createBinaryExpression(a, operator, b),
                operator,
                c,
              );
          const events: string[] = [];
          const operand = (label: string) => ({
            valueOf() {
              events.push(label);
              return 3;
            },
          });
          new Function("a", "b", "c", `return (${printer.print(expression)});`)(
            operand("a"),
            operand("b"),
            operand("c"),
          );
          assert.deepEqual(
            events,
            rightAssociated ? ["b", "c", "a"] : ["a", "b", "c"],
          );
        },
      );
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Printed expression semantics failed.");
}
