package linthost

import "testing"

// TestRuleCorpusJestExpectExpect verifies the lint rule corpus fixture jest/expect-expect.ts.
//
// Jest tests without assertions can pass without checking behavior. This pins
// the SourceFile scan that finds a test callback and verifies it contains an
// expect-family call.
//
// 1. Load a Jest test body with no assertion.
// 2. Enable jest/expect-expect from the annotated expect comment.
// 3. Assert the unasserted test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies an assertion-free callback is reported for jest/expect-expect; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations A test must contain an assertion to establish behavior. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases An expect matcher inside the callback supplies that assertion. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestExpectExpect is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestExpectExpect(t *testing.T) {
  assertRuleCorpusCase(t, "jest-expect-expect.ts", `import { test } from "@jest/globals";

// expect: jest/expect-expect error
test("loads data", () => {
  const value = 1 + 1;
});
`)
  assertRuleSkipsSource(t, "jest/expect-expect", "import { test, expect } from \"@jest/globals\"; test(\"checks\", () => { expect(1).toBe(1); });\n")
}
