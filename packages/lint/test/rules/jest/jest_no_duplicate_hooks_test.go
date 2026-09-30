package linthost

import "testing"

// TestRuleCorpusJestNoDuplicateHooks verifies the lint rule corpus fixture
// jest/no-duplicate-hooks.ts.
//
// Duplicate lifecycle hooks in the same suite obscure setup order. This pins
// the per-suite hook de-duplication map.
//
// 1. Load a suite with two beforeEach hooks.
// 2. Enable jest/no-duplicate-hooks from the annotated expect comment.
// 3. Assert the second hook is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies the second beforeEach in a suite is reported for jest/no-duplicate-hooks; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations Duplicated hook kinds in the same suite repeat setup. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases A beforeEach and afterEach have distinct lifecycle ownership. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoDuplicateHooks is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoDuplicateHooks(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-duplicate-hooks.ts", `import { describe, beforeEach } from "@jest/globals";

describe("suite", () => {
  beforeEach(() => {});
  // expect: jest/no-duplicate-hooks error
  beforeEach(() => {});
});
`)
  assertRuleSkipsSource(t, "jest/no-duplicate-hooks", "import { describe, beforeEach, afterEach } from \"@jest/globals\"; describe(\"suite\", () => { beforeEach(() => {}); afterEach(() => {}); });\n")
}
