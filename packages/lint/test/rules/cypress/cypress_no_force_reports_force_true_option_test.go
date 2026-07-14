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
func TestCypressNoForceReportsForceTrueOption(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").click({ force: true });
  `)
  findings := NewEngine(RuleConfig{"cypress/no-force": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-force" {
    t.Fatalf("want one no-force finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
