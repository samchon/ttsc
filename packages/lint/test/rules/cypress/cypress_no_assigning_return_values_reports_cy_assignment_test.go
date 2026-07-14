package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoAssigningReturnValuesReportsCyAssignment verifies cy command assignment detection.
//
// Cypress commands enqueue work and do not return the eventual subject. Storing
// the return value is therefore misleading even when the TypeScript syntax is a
// normal const declaration.
//
//  1. Parse a Cypress spec that assigns `cy.get()` to a const.
//  2. Enable `cypress/no-assigning-return-values`.
//  3. Assert the assignment is reported once.
func TestCypressNoAssigningReturnValuesReportsCyAssignment(t *testing.T) {
  file := parseTS(t, `
    const button = cy.get("button");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-assigning-return-values": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-assigning-return-values" {
    t.Fatalf("want one no-assigning-return-values finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
