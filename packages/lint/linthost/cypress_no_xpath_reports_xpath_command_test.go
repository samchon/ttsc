package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoXpathReportsXpathCommand verifies xpath command detection.
//
// Cypress XPath plugin support is deprecated. The rule flags the `cy.xpath`
// command so projects can migrate selectors to supported Cypress APIs.
//
//  1. Parse a `cy.xpath(...)` command.
//  2. Enable `cypress/no-xpath`.
//  3. Assert the xpath command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-xpath enabled runs over `cy.xpath("//button");`; the test requires exactly one finding whose rule is cypress/no-xpath at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations The xpath command relies on a deprecated plugin, while CSS get lookup is the supported selector API. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.xpath("//button");` yields one finding. Negative control: `cy.get("button");` is run through assertRuleSkipsSource and must yield zero findings; a CSS cy.get lookup is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressNoXpathReportsXpathCommand is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressNoXpathReportsXpathCommand(t *testing.T) {
  file := parseTS(t, `
    cy.xpath("//button");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-xpath": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-xpath", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-xpath" {
    t.Fatalf("want one no-xpath finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-xpath", "cy.get(\"button\");\n")
}
