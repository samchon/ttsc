package linthost

import "testing"

// TestRuleCorpusJestPreferToHaveLength verifies the lint rule corpus fixture jest/prefer-to-have-length.ts.
//
// Comparing `.length` with a generic matcher produces weaker failure messages.
// This pins the matcher-chain scan that recognizes `expect(value.length).toBe`.
//
// 1. Load a Jest assertion comparing an array length.
// 2. Enable jest/prefer-to-have-length from the annotated expect comment.
// 3. Assert the generic length matcher is reported.
func TestRuleCorpusJestPreferToHaveLength(t *testing.T) {
  assertRuleCorpusCase(t, "jest-prefer-to-have-length.ts", `import { test, expect } from "@jest/globals";

test("checks length", () => {
  const values = [1, 2, 3];
  // expect: jest/prefer-to-have-length error
  expect(values.length).toBe(3);
});
`)
}
