package linthost

import "testing"

// TestRuleCorpusJestValidDescribeCallback verifies the lint rule corpus fixture
// jest/valid-describe-callback.ts.
//
// Async describe callbacks are not awaited by Jest. This pins the callback
// validation branch for suite declarations.
//
// 1. Load an async describe callback.
// 2. Enable jest/valid-describe-callback from the annotated expect comment.
// 3. Assert the callback is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies an async describe callback is reported for jest/valid-describe-callback; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations Suite registration must finish synchronously. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases A synchronous callback registers the suite deterministically. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestValidDescribeCallback is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestValidDescribeCallback(t *testing.T) {
  assertRuleCorpusCase(t, "jest-valid-describe-callback.ts", `import { describe } from "@jest/globals";

describe("suite", 
  // expect: jest/valid-describe-callback error
  async () => {});
`)
  assertRuleSkipsSource(t, "jest/valid-describe-callback", "import { describe } from \"@jest/globals\"; describe(\"suite\", () => {});\n")
}
