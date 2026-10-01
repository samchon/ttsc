package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoDebugReportsDebugCommand verifies debug command detection.
//
// `cy.debug()` changes local runner behavior and is normally an accidental
// leftover. The rule must also catch the common chained form after a selector.
//
//  1. Parse `cy.get(...).debug()`.
//  2. Enable `cypress/no-debug`.
//  3. Assert the debug command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-debug enabled runs over `cy.get("button").debug();`; the test requires exactly one finding whose rule is cypress/no-debug at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations debug is an interactive debugging leftover, not a test action, and here it is chained after a selector. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.get("button").debug();` yields one finding. Negative control: `cy.get("button").click();` is run through assertRuleSkipsSource and must yield zero findings; the same selector followed by an ordinary click is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressNoDebugReportsDebugCommand is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressNoDebugReportsDebugCommand(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").debug();
  `)
  findings := NewEngine(RuleConfig{"cypress/no-debug": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-debug", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-debug" {
    t.Fatalf("want one no-debug finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-debug", "cy.get(\"button\").click();\n")
}
