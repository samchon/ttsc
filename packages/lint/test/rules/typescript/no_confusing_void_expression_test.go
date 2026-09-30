package linthost

import "testing"

// TestRuleCorpusTypescriptNoConfusingVoidExpression verifies the lint
// rule corpus fixture typescript-no-confusing-void-expression.ts.
//
// The rule fires on `void X` expressions placed in value positions
// (initializer, call argument, return statement, binary, ternary).
// Statement, arrow concise body, and nested `void void x` uses are
// negative cases.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification Void in supported value positions must report.
// @evidence contracts/testing.md#independent-expectations Five authored markers fix errors for initializer, argument, return, binary and ternary positions.
// @evidence contracts/testing.md#distinguishing-cases Statements, arrow concise bodies and nested void operands are clean; the oracle certifies syntax policy rather than inferred return effects.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTypescriptNoConfusingVoidExpression executes the AST Engine through assertRuleCorpusCase in the shared Go unit population; every original source/marker is preserved and no native artifact build, installation or child compiler runs.
func TestRuleCorpusTypescriptNoConfusingVoidExpression(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-no-confusing-void-expression.ts", "declare const x: unknown;\n\n// Positive: void in a variable initializer.\n// expect: typescript/no-confusing-void-expression error\nconst a = void x;\n\n// Positive: void as a call argument.\nfunction take(value: unknown): void {\n  JSON.stringify(value);\n}\n// expect: typescript/no-confusing-void-expression error\ntake(void x);\n\n// Positive: void in a return statement.\nfunction wrapped(): unknown {\n  // expect: typescript/no-confusing-void-expression error\n  return void x;\n}\n\n// Positive: void in a binary expression.\n// expect: typescript/no-confusing-void-expression error\nconst sum = (void x) + 1;\n\n// Positive: void in a ternary.\n// expect: typescript/no-confusing-void-expression error\nconst picked = (void x) ? 1 : 2;\n\n// Negative: void as an expression statement.\nvoid x;\n\n// Negative: void as an arrow function concise body.\nconst noop = () => void x;\n\n// Negative: nested void void — only the outer is checked; the inner\n// is acceptable as the operand of another `void`.\nvoid void x;\n\nJSON.stringify({ a, take, wrapped, sum, picked, noop });\n")
}
