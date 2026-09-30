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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies toBe over values.length is reported for jest/prefer-to-have-length; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations The dedicated length matcher describes the collection assertion directly. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases toHaveLength removes the generic length comparison. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestPreferToHaveLength is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestPreferToHaveLength(t *testing.T) {
  assertRuleCorpusCase(t, "jest-prefer-to-have-length.ts", `import { test, expect } from "@jest/globals";

test("checks length", () => {
  const values = [1, 2, 3];
  // expect: jest/prefer-to-have-length error
  expect(values.length).toBe(3);
});
`)
  assertRuleSkipsSource(t, "jest/prefer-to-have-length", "import { test, expect } from \"@jest/globals\"; test(\"length\", () => { expect([1, 2, 3]).toHaveLength(3); });\n")
}
