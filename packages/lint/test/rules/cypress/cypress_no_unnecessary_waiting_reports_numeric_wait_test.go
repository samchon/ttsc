package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoUnnecessaryWaitingReportsNumericWait verifies arbitrary wait detection.
//
// Numeric `cy.wait` calls sleep for time rather than synchronizing on application
// state. Alias waits remain allowed because they are string selectors, not number
// literals.
//
//  1. Parse `cy.wait(250)`.
//  2. Enable `cypress/no-unnecessary-waiting`.
//  3. Assert the numeric wait is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-unnecessary-waiting enabled runs over `cy.wait(250);`; the test requires exactly one finding whose rule is cypress/no-unnecessary-waiting at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations A numeric wait sleeps for elapsed time, whereas an alias wait synchronizes on a known request. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.wait(250);` yields one finding. Negative control: `cy.wait("@request");` is run through assertRuleSkipsSource and must yield zero findings; a string alias wait is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressNoUnnecessaryWaitingReportsNumericWait is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressNoUnnecessaryWaitingReportsNumericWait(t *testing.T) {
  file := parseTS(t, `
    cy.wait(250);
  `)
  findings := NewEngine(RuleConfig{"cypress/no-unnecessary-waiting": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-unnecessary-waiting", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-unnecessary-waiting" {
    t.Fatalf("want one no-unnecessary-waiting finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-unnecessary-waiting", "cy.wait(\"@request\");\n")
}
