import { TestValidator } from "@nestia/e2e";
import factory, { type Expression, SyntaxKind } from "@ttsc/factory";
import ts from "ts-legacy";

import { id, print } from "../../internal/helpers";
import { assertOracle, wide } from "../../internal/oracle";

const qd = () => factory.createToken(SyntaxKind.QuestionDotToken);
const lqd = () => ts.factory.createToken(ts.SyntaxKind.QuestionDotToken);
const lid = (text: string) => ts.factory.createIdentifier(text);

/** `a?.b`, built twice. */
const propertyChain = (): Expression =>
  factory.createPropertyAccessChain(id("a"), qd(), "b");
const legacyPropertyChain = (): ts.Expression =>
  ts.factory.createPropertyAccessChain(lid("a"), lqd(), lid("b"));

/** `a?.()`, built twice. */
const callChain = (): Expression =>
  factory.createCallChain(id("a"), qd(), undefined, []);
const legacyCallChain = (): ts.Expression =>
  ts.factory.createCallChain(lid("a"), lqd(), undefined, []);

/** `a?.[0]`, built twice. */
const elementChain = (): Expression =>
  factory.createElementAccessChain(
    id("a"),
    qd(),
    factory.createNumericLiteral("0"),
  );
const legacyElementChain = (): ts.Expression =>
  ts.factory.createElementAccessChain(
    lid("a"),
    lqd(),
    ts.factory.createNumericLiteral("0"),
  );

/**
 * Verifies an optional chain consumed by a non-optional parent is
 * parenthesized.
 *
 * Pins `TsPrinter.leftSideExpression`'s `optionalChain` argument, which is the
 * consuming node's chain-ness, not the operand's. Emitting `(a?.b)()` as
 * `a?.b()` re-parses the call *into* the chain, so a nullish head stops
 * throwing and quietly evaluates to `undefined`; in `new`, tagged-template and
 * decorator position the same omission does not compile at all (TS1209,
 * TS1358, TS1146). Every expectation below is the legacy printer's own output
 * for the same tree, taken through the differential oracle rather than from
 * this printer.
 *
 * 1. Print each non-optional consumer over each optional-chain node kind.
 * 2. Assert the printed text means what the legacy printer's text means, and
 *    pin the exact string where the two printers also agree on spacing.
 * 3. Assert the negative twins — a consumer that continues the same chain, and
 *    a postfix update, which the legacy parenthesizer does not guard — stay
 *    bare.
 */
export const test_optional_chain_operand_parentheses = (): void => {
  const rows: [string, Expression, ts.Expression, string][] = [
    [
      "call",
      factory.createCallExpression(propertyChain(), undefined, []),
      ts.factory.createCallExpression(legacyPropertyChain(), undefined, []),
      "(a?.b)()",
    ],
    [
      "new",
      factory.createNewExpression(propertyChain(), undefined, []),
      ts.factory.createNewExpression(legacyPropertyChain(), undefined, []),
      "new (a?.b)()",
    ],
    [
      "property access",
      factory.createPropertyAccessExpression(propertyChain(), "c"),
      ts.factory.createPropertyAccessExpression(
        legacyPropertyChain(),
        lid("c"),
      ),
      "(a?.b).c",
    ],
    [
      "element access",
      factory.createElementAccessExpression(
        propertyChain(),
        factory.createNumericLiteral("0"),
      ),
      ts.factory.createElementAccessExpression(
        legacyPropertyChain(),
        ts.factory.createNumericLiteral("0"),
      ),
      "(a?.b)[0]",
    ],
    [
      "property access over a call chain",
      factory.createPropertyAccessExpression(callChain(), "c"),
      ts.factory.createPropertyAccessExpression(legacyCallChain(), lid("c")),
      "(a?.()).c",
    ],
    [
      "element access over an element chain",
      factory.createElementAccessExpression(
        elementChain(),
        factory.createNumericLiteral("1"),
      ),
      ts.factory.createElementAccessExpression(
        legacyElementChain(),
        ts.factory.createNumericLiteral("1"),
      ),
      "(a?.[0])[1]",
    ],
    [
      "non-null assertion",
      factory.createNonNullExpression(propertyChain()),
      ts.factory.createNonNullExpression(legacyPropertyChain()),
      "(a?.b)!",
    ],
    [
      "call over a non-null chain",
      factory.createCallExpression(
        factory.createNonNullChain(propertyChain()),
        undefined,
        [],
      ),
      ts.factory.createCallExpression(
        ts.factory.createNonNullChain(legacyPropertyChain()),
        undefined,
        [],
      ),
      "(a?.b!)()",
    ],
  ];
  for (const [title, node, oracle, expected] of rows) {
    const printed: string = wide.print(node);
    TestValidator.equals(title, printed, expected);
    assertOracle(title, printed, ts.factory.createExpressionStatement(oracle));
  }

  // the tagged-template tag and the decorator expression are the same rule in
  // positions the printer spaces differently from the legacy printer, so only
  // their meaning is compared
  const tagged: string = wide.print(
    factory.createTaggedTemplateExpression(
      propertyChain(),
      undefined,
      factory.createNoSubstitutionTemplateLiteral("x"),
    ),
  );
  TestValidator.equals("tagged template tag", tagged, "(a?.b)`x`");
  assertOracle(
    "tagged template tag",
    tagged,
    ts.factory.createExpressionStatement(
      ts.factory.createTaggedTemplateExpression(
        legacyPropertyChain(),
        undefined,
        ts.factory.createNoSubstitutionTemplateLiteral("x"),
      ),
    ),
  );
  const decorated: string = wide.print(
    factory.createClassDeclaration(
      [factory.createDecorator(propertyChain())],
      "A",
      undefined,
      undefined,
      [],
    ),
  );
  TestValidator.equals(
    "decorator expression",
    decorated,
    "@(a?.b)\nclass A {}",
  );
  assertOracle(
    "decorator expression",
    decorated,
    ts.factory.createClassDeclaration(
      [ts.factory.createDecorator(legacyPropertyChain())],
      lid("A"),
      undefined,
      undefined,
      [],
    ),
  );

  // negative twins: a consumer continuing the same chain adds nothing, and the
  // legacy parenthesizer does not guard the postfix-update operand either
  TestValidator.equals(
    "property chain over a call chain",
    print(factory.createPropertyAccessChain(callChain(), qd(), "b")),
    "a?.()?.b",
  );
  TestValidator.equals(
    "element chain over a property chain",
    print(
      factory.createElementAccessChain(
        propertyChain(),
        qd(),
        factory.createNumericLiteral("0"),
      ),
    ),
    "a?.b?.[0]",
  );
  TestValidator.equals(
    "call chain over a property chain",
    print(factory.createCallChain(propertyChain(), qd(), undefined, [])),
    "a?.b?.()",
  );
  TestValidator.equals(
    "non-null chain over a property chain",
    print(factory.createNonNullChain(propertyChain())),
    "a?.b!",
  );
  TestValidator.equals(
    "chain link without its own question dot",
    print(factory.createPropertyAccessChain(propertyChain(), undefined, "c")),
    "a?.b.c",
  );
  TestValidator.equals(
    "postfix update over a chain",
    print(
      factory.createPostfixUnaryExpression(
        propertyChain(),
        SyntaxKind.PlusPlusToken,
      ),
    ),
    "a?.b++",
  );
  TestValidator.equals(
    "plain access needs nothing",
    print(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(id("a"), "b"),
        undefined,
        [],
      ),
    ),
    "a.b()",
  );
};
