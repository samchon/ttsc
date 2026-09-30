package linthost

import "testing"

// TestRuleCorpusTypescriptNoArrayForEach verifies the lint rule corpus
// fixture typescript-no-array-for-each.ts.
//
// The rule fires on any `.forEach(...)` call by syntactic shape; the
// receiver type is not consulted (matching upstream).
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
// @evidence contracts/testing.md#behavioral-verification Syntactic forEach calls must report under the configured policy.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/no-array-for-each error at line 2; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases A for-of loop with the same body remains clean; this syntactic oracle does not claim receiver-type analysis.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusTypescriptNoArrayForEach invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusTypescriptNoArrayForEach(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-no-array-for-each.ts", "// expect: typescript/no-array-for-each error\n[1, 2, 3].forEach((value) => {\n  JSON.stringify(value);\n});\n")
  assertRuleSkipsSource(t, "typescript/no-array-for-each", "for (const value of [1, 2, 3]) { JSON.stringify(value); }\n")
}
