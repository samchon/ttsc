package linthost

import "testing"

// TestRuleCorpusNoMixedEnums keeps the TypeScript corpus case in the Go rule audit.
// @evidence contracts/testing.md#behavioral-verification Mixed numeric/string enum members must report.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/no-mixed-enums error at line 4; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases A homogeneous numeric enum remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoMixedEnums invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusNoMixedEnums(t *testing.T) {
  assertRuleCorpusCase(t, "no-mixed-enums.ts", `enum Mixed {
  A = 1,
  // expect: typescript/no-mixed-enums error
  B = "two",
}
JSON.stringify(Mixed.A);
`)
  assertRuleSkipsSource(t, "typescript/no-mixed-enums", "enum Uniform { A = 1, B = 2 }\n")
}
