package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoAndReportsChainStartingAnd verifies assertion chain starter detection.
//
// `.and()` reads naturally after an assertion but is unclear as the first
// assertion method. This pins the previous-method check for a selector followed
// directly by `.and()`.
//
//  1. Parse `cy.get(...).and(...)`.
//  2. Enable `cypress/no-and`.
//  3. Assert the chain-starting `.and()` is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-and enabled runs over `cy.get("button").and("be.visible");`; the test requires exactly one finding whose rule is cypress/no-and at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations `.and()` only continues an assertion chain, so it is wrong when its predecessor in the chain is a non-assertion command such as get. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.get("button").and("be.visible");` yields one finding. Negative control: `cy.get("button").should("be.visible").and("be.enabled");` is run through assertRuleSkipsSource and must yield zero findings; the same `.and()` is accepted once its predecessor is `.should()`.
// @evidence contracts/testing.md#execution-ownership TestCypressNoAndReportsChainStartingAnd is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressNoAndReportsChainStartingAnd(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").and("be.visible");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-and": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-and", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-and" {
    t.Fatalf("want one no-and finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-and", "cy.get(\"button\").should(\"be.visible\").and(\"be.enabled\");\n")
}
