package linthost

import "testing"

// TestRuleCorpusTypescriptExplicitMemberAccessibility verifies the lint
// rule corpus fixture typescript-explicit-member-accessibility.ts.
//
// The rule fires on class members lacking an explicit `public` /
// `private` / `protected` modifier; private-hash members are exempt.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
// @evidence contracts/testing.md#behavioral-verification Class members lacking accessibility must report.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/explicit-member-accessibility error at line 3; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases Explicit public and private-hash fields distinguish required modifiers from exempt members.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTypescriptExplicitMemberAccessibility invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusTypescriptExplicitMemberAccessibility(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-explicit-member-accessibility.ts", "class Foo {\n  // expect: typescript/explicit-member-accessibility error\n  value: number = 0;\n}\nJSON.stringify(Foo);\n")
  assertRuleSkipsSource(t, "typescript/explicit-member-accessibility", "class Foo { public value: number = 0; #privateValue = 1; }\n")
}
