package linthost

import "testing"

// TestRuleCorpusNoUnusedExpressionsDirectiveBoundaries verifies the lint rule corpus fixture
// no-unused-expressions-directive-boundaries.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case pins where a directive prologue ends: a parenthesized string is not a directive and
// terminates the leading run (so the unparenthesized string after it is misplaced), strings after
// the first non-string statement are misplaced at file, function, and namespace level, and class
// static blocks own no prologue at all.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoUnusedExpressionsDirectiveBoundaries(t *testing.T) {
  assertRuleCorpusCase(t, "no-unused-expressions-directive-boundaries.ts", "// expect: no-unused-expressions error\n(\"use strict\");\n// expect: no-unused-expressions error\n\"use client\";\n\nconst ready: boolean = true;\n\n// expect: no-unused-expressions error\n\"misplaced after statement\";\n\nfunction scoped(): void {\n  \"use scoped\";\n  void ready;\n  // expect: no-unused-expressions error\n  \"use late\";\n}\n\nclass Widget {\n  static {\n    // expect: no-unused-expressions error\n    \"use static\";\n  }\n}\n\nnamespace Space {\n  \"use namespace\";\n  export const marker: number = 1;\n  // expect: no-unused-expressions error\n  \"after namespace statement\";\n}\n\nscoped();\nvoid Widget;\nvoid Space.marker;\n")
}
