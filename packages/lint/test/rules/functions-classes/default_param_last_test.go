package linthost

import "testing"

// TestRuleCorpusDefaultParamLast keeps the TypeScript corpus case in the Go rule audit.
func TestRuleCorpusDefaultParamLast(t *testing.T) {
  assertRuleCorpusCase(t, "default-param-last.ts", `function bad(
  // expect: default-param-last error
  a = 1,
  b: number,
): number {
  return a + b;
}
JSON.stringify(bad(undefined, 2));
`)
}
