import { TestValidator } from "@nestia/e2e";
import factory, { type Expression } from "../../../../../packages/factory/src/index";
import ts from "ts-legacy";

import { id, print, reparse } from "../../internal/helpers";

const call = (expression: Expression): Expression =>
  factory.createCallExpression(expression, undefined, []);
const construct = (target: Expression): Expression =>
  factory.createNewExpression(target, undefined, []);

/**
 * Verifies new-expression parenthesizer: wraps a target whose member chain
 * contains a call.
 *
 * Locks the stop-at-call leftmost walk in `TsPrinter.newExpressionTarget`. The
 * old check looked only at the target's direct kind, so a call deeper in the
 * chain printed bare: `new (f().bar)()` became `new f().bar()`, which re-parses
 * as `(new f()).bar()` — the call's arguments re-bind to the `new` and the
 * program changes. The target's leftmost node decides, wherever the call sits
 * in the chain.
 *
 * 1. Print `new` expressions whose targets are `f().bar` (call at the chain head),
 *    `a.b().c` (call mid-chain), and `f()[0]` (element access over a call).
 * 2. Assert every target is parenthesized, matching the legacy `ts.Printer`.
 * 3. Re-parse each output with the legacy compiler and assert the top-level
 *    expression is still a `NewExpression` (the bug shape re-parses as a
 *    top-level `CallExpression` instead).
 *
 * @evidence contracts/testing.md#behavioral-verification A call anywhere on the new target spine is enclosed before the outer constructor arguments.
 * @evidence contracts/testing.md#independent-expectations Explicit source expectations and TypeScript NewExpression reparsing independently detect calls consuming outer arguments.
 * @evidence contracts/testing.md#distinguishing-cases Head, intermediate property and element chain call positions test spine traversal rather than only immediate node kind.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_new_expression_target_call_in_chain_parentheses. Builds call/property/element chains under createNewExpression and runs print plus reparse.
 */
export const test_new_expression_target_call_in_chain_parentheses =
  (): void => {
    const printed = {
      "call at chain head": print(
        construct(factory.createPropertyAccessExpression(call(id("f")), "bar")),
      ),
      "call mid-chain": print(
        construct(
          factory.createPropertyAccessExpression(
            call(factory.createPropertyAccessExpression(id("a"), "b")),
            "c",
          ),
        ),
      ),
      "element access over call": print(
        construct(factory.createElementAccessExpression(call(id("f")), 0)),
      ),
    };
    TestValidator.equals(
      "call at chain head",
      printed["call at chain head"],
      "new (f().bar)()",
    );
    TestValidator.equals(
      "call mid-chain",
      printed["call mid-chain"],
      "new (a.b().c)()",
    );
    TestValidator.equals(
      "element access over call",
      printed["element access over call"],
      "new (f()[0])()",
    );
    for (const [title, source] of Object.entries(printed))
      TestValidator.equals(
        `${title} re-parses as new`,
        reparse(source).kind,
        ts.SyntaxKind.NewExpression,
      );
  };
