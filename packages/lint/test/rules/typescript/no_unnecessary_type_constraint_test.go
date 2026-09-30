package linthost

import "testing"

// TestRuleCorpusNoUnnecessaryTypeConstraint verifies the lint rule corpus fixture no-unnecessary-type-constraint.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-unnecessary-type-constraint.ts and
// compares normalized rule, severity, and line triples. The source text stays embedded in the
// generated Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification An unknown generic constraint must report as unnecessary.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/no-unnecessary-type-constraint error at line 2; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases A concrete string constraint remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnnecessaryTypeConstraint invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusNoUnnecessaryTypeConstraint(t *testing.T) {
  assertRuleCorpusCase(t, "no-unnecessary-type-constraint.ts", "// expect: typescript/no-unnecessary-type-constraint error\nfunction identity<T extends unknown>(value: T): T {\n  return value;\n}\n")
  assertRuleSkipsSource(t, "typescript/no-unnecessary-type-constraint", "function identity<T extends string>(value: T): T { return value; }\n")
}
