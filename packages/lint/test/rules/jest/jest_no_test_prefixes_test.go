package linthost

import "testing"

// TestRuleCorpusJestNoTestPrefixes verifies the lint rule corpus fixture
// jest/no-test-prefixes.ts.
//
// Prefix aliases such as `fit` bypass more explicit `.only`/`.skip` spelling.
// This pins the alias matcher independently from focused/disabled policies.
//
// 1. Load a focused-prefix Jest test.
// 2. Enable jest/no-test-prefixes from the annotated expect comment.
// 3. Assert the prefixed call is reported.
func TestRuleCorpusJestNoTestPrefixes(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-test-prefixes.ts", `import { fit, expect } from "@jest/globals";

// expect: jest/no-test-prefixes error
fit("focuses", () => {
  expect(1).toBe(1);
});
`)
}
