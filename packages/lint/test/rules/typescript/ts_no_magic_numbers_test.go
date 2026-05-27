package linthost

import "testing"

// TestRuleCorpusTypeScriptNoMagicNumbers verifies the lint rule corpus
// fixture typescript-no-magic-numbers.ts.
//
// `typescript/no-magic-numbers` is AST-only: it fires on a
// `KindNumericLiteral` that is not inside a type position, is not an
// enum member initializer, and is not one of the well-known unit
// values (`-1`, `0`, `1`). The fixture covers both the positive
// triggers (bare comparisons / arithmetic, unary-negated literals)
// and the TS-specific negative path where the literal IS the enum
// member initializer the rule wants the author to use.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusTypeScriptNoMagicNumbers(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-no-magic-numbers.ts", "// Positive: bare magic number in a comparison.\nfunction isLong(value: number): boolean {\n  // expect: typescript/no-magic-numbers error\n  return value > 86400;\n}\n\n// Positive: magic number in an arithmetic expression.\nfunction feeFor(amount: number): number {\n  // expect: typescript/no-magic-numbers error\n  return amount * 0.035;\n}\n\n// Positive: magic number wrapped in unary minus.\nfunction offsetOf(value: number): number {\n  // expect: typescript/no-magic-numbers error\n  return value + -42;\n}\n\n// Negative: enum member initializers are the lifting step.\nenum HttpStatus {\n  Ok = 200,\n  NotFound = 404,\n  ServerError = 500,\n}\n\n// Negative: literal numeric type — type position.\ntype ZeroOrOne = 0 | 1;\n\n// Negative: unit values carry intrinsic meaning.\nconst counter = 0;\nconst stepSize = 1;\nconst notFound = -1;\n\nJSON.stringify({\n  isLong,\n  feeFor,\n  offsetOf,\n  HttpStatus,\n  counter,\n  stepSize,\n  notFound,\n  zeroOrOne: null as ZeroOrOne | null,\n});\n")
}
