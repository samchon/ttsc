package linthost

import "testing"

// TestRuleCorpusMaxParams verifies the lint rule corpus fixture max-params.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in max-params.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusMaxParams(t *testing.T) {
  assertRuleCorpusCase(t, "max-params.ts", "// Positive: a four-parameter function declaration exceeds the default\n// limit of three.\n// expect: max-params error\nfunction four(a: number, b: number, c: number, d: number): number {\n  return a + b + c + d;\n}\n\n// Positive: arrow functions are flagged on the same terms.\n// expect: max-params error\nconst fiveArrow = (a: number, b: number, c: number, d: number, e: number): number => a + b + c + d + e;\n\n// Positive: methods inside a class declaration use the same threshold.\nclass Calculator {\n  // expect: max-params error\n  combine(a: number, b: number, c: number, d: number): number {\n    return a + b + c + d;\n  }\n}\n\n// Negative: exactly three parameters is at the limit, not over it.\nfunction three(a: number, b: number, c: number): number {\n  return a + b + c;\n}\n\n// Negative: a zero-parameter function is trivially under the limit.\nfunction noArgs(): number {\n  return 0;\n}\n\nJSON.stringify({\n  four: four(1, 2, 3, 4),\n  fiveArrow: fiveArrow(1, 2, 3, 4, 5),\n  combine: new Calculator().combine(1, 2, 3, 4),\n  three: three(1, 2, 3),\n  noArgs: noArgs(),\n});\n")
}
