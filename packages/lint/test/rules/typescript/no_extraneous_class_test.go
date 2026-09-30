package linthost

import "testing"

// TestRuleCorpusTypescriptNoExtraneousClass verifies the lint rule
// corpus fixture typescript-no-extraneous-class.ts.
//
// The rule fires on classes without `extends`/`implements` whose body
// is empty or contains only static members and trivial constructors.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
// @evidence contracts/testing.md#behavioral-verification A static-only class must report as an extraneous namespace.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/no-extraneous-class error at line 2; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases A class with an instance field remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTypescriptNoExtraneousClass invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusTypescriptNoExtraneousClass(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-no-extraneous-class.ts", "// expect: typescript/no-extraneous-class error\nclass StaticOnly {\n  static factory(): number {\n    return 1;\n  }\n}\nJSON.stringify(StaticOnly);\n")
  assertRuleSkipsSource(t, "typescript/no-extraneous-class", "class Instance { value = 1; }\n")
}
