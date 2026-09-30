package linthost

import "testing"

// TestRuleCorpusJestRequireToThrowMessage verifies the lint rule corpus fixture
// jest/require-to-throw-message.ts.
//
// Message-less throw assertions can pass for the wrong exception. This pins the
// matcher chain path from `expect(fn).toThrow()`.
//
// 1. Load a message-less toThrow matcher.
// 2. Enable jest/require-to-throw-message from the annotated expect comment.
// 3. Assert the matcher call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies toThrow without a message is reported for jest/require-to-throw-message; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations A message-less exception assertion can accept the wrong error. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases The literal message identifies the intended exception. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestRequireToThrowMessage is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestRequireToThrowMessage(t *testing.T) {
  assertRuleCorpusCase(t, "jest-require-to-throw-message.ts", `import { test, expect } from "@jest/globals";

test("throws", () => {
  // expect: jest/require-to-throw-message error
  expect(() => { throw new Error("x"); }).toThrow();
});
`)
  assertRuleSkipsSource(t, "jest/require-to-throw-message", "import { test, expect } from \"@jest/globals\"; test(\"throws\", () => { expect(() => { throw new Error(\"x\"); }).toThrow(\"x\"); });\n")
}
