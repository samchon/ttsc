package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoPauseReportsPauseCommand verifies pause command detection.
//
// `cy.pause()` is useful while debugging locally but should not remain in specs
// committed to the project. This test exercises only the root `cy.pause()` form.
//
//  1. Parse a root `cy.pause()` command.
//  2. Enable `cypress/no-pause`.
//  3. Assert the pause command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-pause enabled runs over `cy.pause();`; the test requires exactly one finding whose rule is cypress/no-pause at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations pause halts the run for interactive debugging and must not remain in a spec. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.pause();` yields one finding. Negative control: `cy.get("button");` is run through assertRuleSkipsSource and must yield zero findings; an ordinary selector command is accepted. Only the root cy.pause() form is exercised here.
// @evidence contracts/testing.md#execution-ownership TestCypressNoPauseReportsPauseCommand is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressNoPauseReportsPauseCommand(t *testing.T) {
  file := parseTS(t, `
    cy.pause();
  `)
  findings := NewEngine(RuleConfig{"cypress/no-pause": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-pause", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-pause" {
    t.Fatalf("want one no-pause finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-pause", "cy.get(\"button\");\n")
}
