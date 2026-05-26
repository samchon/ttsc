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
func TestCypressNoUnnecessaryWaitingReportsNumericWait(t *testing.T) {
  file := parseTS(t, `
    cy.wait(250);
  `)
  findings := NewEngine(RuleConfig{"cypress/no-unnecessary-waiting": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-unnecessary-waiting" {
    t.Fatalf("want one no-unnecessary-waiting finding, got %v", got)
  }
}
