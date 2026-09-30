package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoAsyncTestsReportsAsyncIt verifies async test callback detection.
//
// Cypress test callbacks should not be async because Cypress commands already
// manage their own queue. The rule checks Mocha test calls and reports the
// async function argument directly.
//
//  1. Parse an `it` call with an async arrow callback.
//  2. Enable `cypress/no-async-tests`.
//  3. Assert the async test callback is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies an async it callback produces one finding for cypress/no-async-tests; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations Cypress test commands already use their managed queue. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases A synchronous test callback removes the async modifier while keeping the command. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoAsyncTestsReportsAsyncIt is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoAsyncTestsReportsAsyncIt(t *testing.T) {
  file := parseTS(t, `
    it("saves", async () => {
      await cy.get("button");
    });
  `)
  findings := NewEngine(RuleConfig{"cypress/no-async-tests": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-async-tests", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-async-tests" {
    t.Fatalf("want one no-async-tests finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-async-tests", "it(\"saves\", () => { cy.get(\"button\"); });\n")
}
