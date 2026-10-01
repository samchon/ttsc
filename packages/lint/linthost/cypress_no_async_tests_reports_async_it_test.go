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
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-async-tests enabled runs over `it("saves", async () => { await cy.get("button"); });`; the test requires exactly one finding whose rule is cypress/no-async-tests at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations Cypress test callbacks rely on the command queue, so an async arrow callback to it is wrong. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `it("saves", async () => { await cy.get("button"); });` yields one finding. Negative control: `it("saves", () => { cy.get("button"); });` is run through assertRuleSkipsSource and must yield zero findings; the same test with a synchronous arrow callback is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressNoAsyncTestsReportsAsyncIt is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
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
