package linthost

import "testing"

// TestRuleCorpusTypescriptConsistentGenericConstructors verifies the
// lint rule corpus fixture typescript-consistent-generic-constructors.ts.
//
// The rule fires when both the annotation and the `new` expression
// carry the same generic arguments. The diagnostic is attached to the
// constructor call.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
// @evidence contracts/testing.md#behavioral-verification Repeated generic annotation and constructor arguments must report the constructor.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/consistent-generic-constructors error at line 2; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases A constructor-only generic declaration removes the duplicate annotation.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTypescriptConsistentGenericConstructors invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusTypescriptConsistentGenericConstructors(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-consistent-generic-constructors.ts", "// expect: typescript/consistent-generic-constructors error\nconst m: Map<string, number> = new Map<string, number>();\nJSON.stringify(m);\n")
  assertRuleSkipsSource(t, "typescript/consistent-generic-constructors", "const m = new Map<string, number>();\n")
}
