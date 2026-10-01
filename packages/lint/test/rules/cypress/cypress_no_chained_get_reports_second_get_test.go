package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoChainedGetReportsSecondGet verifies chained get detection.
//
// A later `.get()` restarts from the Cypress root instead of searching under the
// previous subject. The rule reports the second get in a Cypress chain.
//
//  1. Parse `cy.get(...).get(...)`.
//  2. Enable `cypress/no-chained-get`.
//  3. Assert the second get is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-chained-get enabled runs over `cy.get("form").get("button");`; the test requires exactly one finding whose rule is cypress/no-chained-get at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations A second get in a chain restarts from the document root instead of searching inside the previous subject. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.get("form").get("button");` yields one finding. Negative control: `cy.get("form").find("button");` is run through assertRuleSkipsSource and must yield zero findings; find on the same subject is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressNoChainedGetReportsSecondGet is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressNoChainedGetReportsSecondGet(t *testing.T) {
  file := parseTS(t, `
    cy.get("form").get("button");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-chained-get": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-chained-get", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-chained-get" {
    t.Fatalf("want one no-chained-get finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-chained-get", "cy.get(\"form\").find(\"button\");\n")
}
