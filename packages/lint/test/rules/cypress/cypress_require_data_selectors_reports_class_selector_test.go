package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressRequireDataSelectorsReportsClassSelector verifies data selector enforcement.
//
// `cy.get` selectors that depend on classes are brittle against styling changes.
// The rule reports statically known selector strings that do not start with a
// `data-*` attribute selector.
//
//  1. Parse `cy.get(".submit")`.
//  2. Enable `cypress/require-data-selectors`.
//  3. Assert the class selector is reported once.
func TestCypressRequireDataSelectorsReportsClassSelector(t *testing.T) {
  file := parseTS(t, `
    cy.get(".submit").click();
  `)
  findings := NewEngine(RuleConfig{"cypress/require-data-selectors": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/require-data-selectors" {
    t.Fatalf("want one require-data-selectors finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
