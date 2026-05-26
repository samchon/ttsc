package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoPauseReportsPauseCommand verifies pause command detection.
//
// `cy.pause()` is useful while debugging locally but should not remain in specs
// committed to the project. The rule recognizes both root and chained Cypress
// calls through the same chain helper.
//
//  1. Parse a root `cy.pause()` command.
//  2. Enable `cypress/no-pause`.
//  3. Assert the pause command is reported once.
func TestCypressNoPauseReportsPauseCommand(t *testing.T) {
  file := parseTS(t, `
    cy.pause();
  `)
  findings := NewEngine(RuleConfig{"cypress/no-pause": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-pause" {
    t.Fatalf("want one no-pause finding, got %v", got)
  }
}
