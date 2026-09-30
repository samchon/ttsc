package linthost

import "testing"

// TestRuleCorpusJestNoIdenticalTitle verifies the lint rule corpus fixture jest/no-identical-title.ts.
//
// Duplicate sibling titles make Jest failures ambiguous. This pins the
// suite-level title map so only titles at the same describe level collide.
//
// 1. Load one describe block with two tests sharing a title.
// 2. Enable jest/no-identical-title from the annotated expect comment.
// 3. Assert the second duplicate title is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies the second sibling adds title is reported for jest/no-identical-title; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations Sibling titles identify failures and must be distinct. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases Distinct sibling titles do not collide in the same describe scope. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoIdenticalTitle is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoIdenticalTitle(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-identical-title.ts", `import { describe, it, expect } from "@jest/globals";

describe("math", () => {
  it("adds", () => {
    expect(1 + 1).toBe(2);
  });

  // expect: jest/no-identical-title error
  it("adds", () => {
    expect(2 + 2).toBe(4);
  });
});
`)
  assertRuleSkipsSource(t, "jest/no-identical-title", "import { describe, it } from \"@jest/globals\"; describe(\"math\", () => { it(\"adds\", () => {}); it(\"subtracts\", () => {}); });\n")
}
