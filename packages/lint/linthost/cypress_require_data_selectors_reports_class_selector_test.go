package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressRequireDataSelectorsReportsClassSelector verifies data selector enforcement.
//
// `cy.get` selectors that depend on classes are brittle against styling changes.
// This case contrasts a class selector with a `data-*` attribute selector.
// The rule also permits `@` aliases; that separate accepted shape is not
// exercised here.
//
//  1. Parse `cy.get(".submit")`.
//  2. Enable `cypress/require-data-selectors`.
//  3. Assert the class selector is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/require-data-selectors enabled runs over `cy.get(".submit").click();`; the test requires exactly one finding whose rule is cypress/require-data-selectors at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations A statically known class selector depends on styling, whereas a data-* attribute selector is the stable form the rule requires. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.get(".submit").click();` yields one finding. Negative control: `cy.get("[data-cy=submit]").click();` is run through assertRuleSkipsSource and must yield zero findings; the data-cy attribute selector is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressRequireDataSelectorsReportsClassSelector is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressRequireDataSelectorsReportsClassSelector(t *testing.T) {
  file := parseTS(t, `
    cy.get(".submit").click();
  `)
  findings := NewEngine(RuleConfig{"cypress/require-data-selectors": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/require-data-selectors", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/require-data-selectors" {
    t.Fatalf("want one require-data-selectors finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/require-data-selectors", "cy.get(\"[data-cy=submit]\").click();\n")
}
