package linthost

import "testing"

// TestRuleCorpusNoRestrictedSyntax verifies the lint rule corpus fixture no-restricted-syntax.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-restricted-syntax.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoRestrictedSyntax(t *testing.T) {
  assertRuleCorpusCase(t, "no-restricted-syntax.ts", "function runWith(target: { value: number }): number {\n  let total = 0;\n  // expect: no-restricted-syntax error\n  with (target) {\n    total = value;\n  }\n  return total;\n}\n\nfunction runLabeled(): number {\n  let acc = 0;\n  // expect: no-restricted-syntax error\n  outer: for (let i = 0; i < 3; i += 1) {\n    for (let j = 0; j < 3; j += 1) {\n      if (i + j > 3) break outer;\n      acc += 1;\n    }\n  }\n  return acc;\n}\n\n// Negative: ordinary statements stay silent.\nfunction plain(value: number): number {\n  return value + 1;\n}\n\nJSON.stringify({\n  runWith: runWith({ value: 7 }),\n  runLabeled: runLabeled(),\n  plain: plain(3),\n});\n")
}
