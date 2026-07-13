package linthost

import "testing"

// TestRuleCorpusNoUnusedExpressions verifies the lint rule corpus fixture no-unused-expressions.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-unused-expressions.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoUnusedExpressions(t *testing.T) {
  assertRuleCorpusCase(t, "no-unused-expressions.ts", "\"use strict\";\n\"use client\";\n\ndeclare function work(): Promise<void>;\ndeclare const tag: (strings: TemplateStringsArray) => string;\n\nvoid work();\n\n// expect: no-unused-expressions error\ntag`value`;\n\n// expect: no-unused-expressions error\n(\"not a directive\");\n\nfunction misplacedDirective(): void {\n  \"use totally custom prologue\";\n  console.log(\"before\");\n  // expect: no-unused-expressions error\n  \"use strict\";\n}\n\nfunction f(a: number, b: number): void {\n  // expect: no-unused-expressions error\n  (a, b);\n}\n\nf(1, 2);\nmisplacedDirective();\n")
}
