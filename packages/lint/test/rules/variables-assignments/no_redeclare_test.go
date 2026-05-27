package linthost

import "testing"

// TestRuleCorpusNoRedeclare verifies the lint rule corpus fixture no-redeclare.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-redeclare.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoRedeclare(t *testing.T) {
  assertRuleCorpusCase(t, "no-redeclare.ts", "// Positive: two `var` declarations of the same name share the script scope.\nvar sample: number = 1;\n// expect: no-redeclare error\nvar sample: number = 2;\nvoid sample;\n\n// Positive: redeclaring a function in the same scope silently overwrites.\nfunction shared(): number {\n  return 1;\n}\n// expect: no-redeclare error\nfunction shared(): number {\n  return 2;\n}\nvoid shared;\n\n// Negative: `let` in an inner block shadows the outer binding rather than\n// redeclaring it — the rule must leave nested-scope reuse alone.\nlet outerLet: number = 1;\n{\n  let outerLet: number = 2;\n  void outerLet;\n}\nvoid outerLet;\n")
}
