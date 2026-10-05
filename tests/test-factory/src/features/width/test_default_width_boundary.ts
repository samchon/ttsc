import { TestValidator } from "@nestia/e2e";

import factory, { TsPrinter } from "../../../../../packages/factory/src/index";
import { structure } from "../../internal/oracle";

/**
 * Verifies the inclusive default 80-column layout boundary.
 *
 * Fitting at exactly the width must remain flat; the next column must break
 * without changing the call's callee or argument.
 *
 * 1. Construct calls whose flat source has exactly 80 and 81 columns.
 * 2. Require the former to remain flat and the latter to break.
 * 3. Compare both layouts with independently spelled source syntax.
 *
 * @evidence contracts/testing.md#behavioral-verification TsPrinter.print must keep an exactly 80-column call flat and break an 81-column call while retaining its argument and callee.
 * @evidence contracts/testing.md#independent-expectations Literal call syntax has three overhead columns (f and two parentheses) plus the explicitly sized argument identifier; the default width is 80, and structure compares the result to independent source rather than another printer run.
 * @evidence contracts/testing.md#distinguishing-cases Adjacent widths 80/81 detect an off-by-one fit decision; argument spelling and parsed call structure must survive the layout change.
 * @evidence contracts/testing.md#execution-ownership test_default_width_boundary directly constructs createCallExpression nodes and runs TsPrinter.print in the Factory unit TestExecutor; its two width rows share only the in-process printer.
 */
export const test_default_width_boundary = (): void => {
  const printer = new TsPrinter();
  for (const width of [80, 81]) {
    const argument = "a".repeat(width - 3);
    const node = factory.createCallExpression(
      factory.createIdentifier("f"),
      undefined,
      [factory.createIdentifier(argument)],
    );
    const actual = printer.print(node);
    const expected = "f(" + argument + ")";
    TestValidator.equals(
      `${width} columns break`,
      actual.includes("\n"),
      width === 81,
    );
    TestValidator.equals(
      `${width} columns preserve syntax`,
      structure(actual + ";"),
      structure(expected + ";"),
    );
    if (width === 80)
      TestValidator.equals("80 columns exact flat text", actual, expected);
  }
};
