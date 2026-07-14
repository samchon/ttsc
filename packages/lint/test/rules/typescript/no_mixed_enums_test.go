package linthost

import "testing"

// TestRuleCorpusNoMixedEnums keeps the TypeScript corpus case in the Go rule audit.
func TestRuleCorpusNoMixedEnums(t *testing.T) {
  assertRuleCorpusCase(t, "no-mixed-enums.ts", `enum Mixed {
  A = 1,
  // expect: typescript/no-mixed-enums error
  B = "two",
}
JSON.stringify(Mixed.A);
`)
}
