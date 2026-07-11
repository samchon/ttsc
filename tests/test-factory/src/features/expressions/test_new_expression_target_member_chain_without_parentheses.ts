import { TestValidator } from "@nestia/e2e";
import factory, { type Expression } from "@ttsc/factory";
import ts from "ts-legacy";

import { id, print, reparse } from "../../internal/helpers";

const construct = (target: Expression): Expression =>
  factory.createNewExpression(target, undefined, []);

/**
 * Verifies new-expression parenthesizer: leaves call-free targets bare.
 *
 * Negative twin of the stop-at-call leftmost walk in
 * `TsPrinter.newExpressionTarget`. An over-match would wrap the everyday
 * targets generators emit constantly — plain identifiers, pure member chains,
 * and inner `new` expressions with argument lists (whose printed `()` already
 * binds their arguments) — and bloat every generated file with useless
 * parentheses.
 *
 * 1. Print `new` expressions targeting `C`, `a.b.C`, `new F()` (inner `new` with
 *    an argument list), and `new F().bar` (member access over it).
 * 2. Assert none of the targets are parenthesized, matching the legacy
 *    `ts.Printer`.
 * 3. Re-parse each output with the legacy compiler and assert the top-level
 *    expression is still a `NewExpression`.
 */
export const test_new_expression_target_member_chain_without_parentheses =
  (): void => {
    const printed = {
      "bare identifier": print(construct(id("C"))),
      "pure member chain": print(
        construct(
          factory.createPropertyAccessExpression(
            factory.createPropertyAccessExpression(id("a"), "b"),
            "C",
          ),
        ),
      ),
      "inner new with arguments": print(
        construct(factory.createNewExpression(id("F"), undefined, [])),
      ),
      "member access over inner new": print(
        construct(
          factory.createPropertyAccessExpression(
            factory.createNewExpression(id("F"), undefined, []),
            "bar",
          ),
        ),
      ),
    };
    TestValidator.equals(
      "bare identifier",
      printed["bare identifier"],
      "new C()",
    );
    TestValidator.equals(
      "pure member chain",
      printed["pure member chain"],
      "new a.b.C()",
    );
    TestValidator.equals(
      "inner new with arguments",
      printed["inner new with arguments"],
      "new new F()()",
    );
    TestValidator.equals(
      "member access over inner new",
      printed["member access over inner new"],
      "new new F().bar()",
    );
    for (const [title, source] of Object.entries(printed))
      TestValidator.equals(
        `${title} re-parses as new`,
        reparse(source).kind,
        ts.SyntaxKind.NewExpression,
      );
  };
