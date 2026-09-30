package linthost

import "testing"

// TestRuleCorpusJestNoStandaloneExpect verifies the lint rule corpus fixture jest/no-standalone-expect.ts.
//
// Expectations directly inside describe blocks execute during suite definition
// instead of as tests. This pins the callback-owner check that distinguishes
// describe callbacks from test callbacks.
//
// 1. Load a describe callback with a direct expect call.
// 2. Enable jest/no-standalone-expect from the annotated expect comment.
// 3. Assert the standalone expect call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies expect directly in describe is reported for jest/no-standalone-expect; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations Suite registration is not a test-result callback. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases The same assertion inside a nested test belongs to a result. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoStandaloneExpect is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoStandaloneExpect(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-standalone-expect.ts", `import { describe, expect } from "@jest/globals";

describe("suite", () => {
  // expect: jest/no-standalone-expect error
  expect(1).toBe(1);
});
`)
  assertRuleSkipsSource(t, "jest/no-standalone-expect", "import { describe, test, expect } from \"@jest/globals\"; describe(\"suite\", () => { test(\"owned\", () => { expect(1).toBe(1); }); });\n")
}
