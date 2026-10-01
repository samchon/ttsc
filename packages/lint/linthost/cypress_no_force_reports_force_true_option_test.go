package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoForceReportsForceTrueOption verifies forced action detection.
//
// `{ force: true }` on Cypress actions bypasses actionability checks. The rule
// should find the option object even when it appears inside a longer chain.
//
//  1. Parse a chained click with `{ force: true }`.
//  2. Enable `cypress/no-force`.
//  3. Assert the forced action is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-force enabled runs over `cy.get("button").click({ force: true });`; the test requires exactly one finding whose rule is cypress/no-force at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations force: true on an action bypasses Cypress actionability checks. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.get("button").click({ force: true });` yields one finding. Negative control: `cy.get("button").click({ force: false });` is run through assertRuleSkipsSource and must yield zero findings; force: false on the same action keeps the checks and is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressNoForceReportsForceTrueOption is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressNoForceReportsForceTrueOption(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").click({ force: true });
  `)
  findings := NewEngine(RuleConfig{"cypress/no-force": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-force", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-force" {
    t.Fatalf("want one no-force finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-force", "cy.get(\"button\").click({ force: false });\n")
}
