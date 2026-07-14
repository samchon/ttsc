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
func TestCypressNoChainedGetReportsSecondGet(t *testing.T) {
  file := parseTS(t, `
    cy.get("form").get("button");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-chained-get": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-chained-get" {
    t.Fatalf("want one no-chained-get finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
