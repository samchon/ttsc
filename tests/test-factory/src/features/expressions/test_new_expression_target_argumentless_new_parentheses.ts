import { TestValidator } from "@nestia/e2e";
import factory, { type Expression } from "@ttsc/factory";
import ts from "ts-legacy";

import { id, print, reparse } from "../../internal/helpers";

const construct = (target: Expression): Expression =>
  factory.createNewExpression(target, undefined, []);

/** An argument-less `new F` node (`arguments` is `undefined`, not `[]`). */
const argumentlessNew = (): Expression =>
  factory.createNewExpression(id("F"), undefined, undefined);

/**
 * Verifies new-expression parenthesizer: keeps parentheses around an
 * argument-less inner `new`, directly and deeper in the chain.
 *
 * Locks the `NewExpression`-without-`arguments` branch of
 * `TsPrinter.newExpressionTargetNeedsParentheses` across the stop-at-call walk.
 * The walk must not recurse through an inner `new` (its target is not on the
 * printed left edge), and an argument-less inner `new` keeps the parentheses
 * the direct case always had — before the fix the deeper shape bypassed the
 * direct-kind check and printed bare. This printer normalizes argument-less
 * `new F` to `new F()`, so the wrap is belt-and-suspenders rather than
 * load-bearing, but it keeps direct and deep shapes consistent (the legacy
 * factory instead parenthesizes at the access level: `new (new F).bar()`; both
 * round-trip to the same program).
 *
 * 1. Print `new` expressions targeting an argument-less `new F` directly and
 *    behind a member access (`new F.bar` would re-parse as `new (F.bar)`).
 * 2. Assert both print parenthesized: `new (new F())()` and `new (new F().bar)()`.
 * 3. Re-parse each output with the legacy compiler and assert the top-level
 *    expression is still a `NewExpression`.
 */
export const test_new_expression_target_argumentless_new_parentheses =
  (): void => {
    const printed = {
      "direct argument-less new": print(construct(argumentlessNew())),
      "member access over argument-less new": print(
        construct(
          factory.createPropertyAccessExpression(argumentlessNew(), "bar"),
        ),
      ),
    };
    TestValidator.equals(
      "direct argument-less new",
      printed["direct argument-less new"],
      "new (new F())()",
    );
    TestValidator.equals(
      "member access over argument-less new",
      printed["member access over argument-less new"],
      "new (new F().bar)()",
    );
    for (const [title, source] of Object.entries(printed))
      TestValidator.equals(
        `${title} re-parses as new`,
        reparse(source).kind,
        ts.SyntaxKind.NewExpression,
      );
  };
