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
func TestCypressNoDebugReportsDebugCommand(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").debug();
  `)
  findings := NewEngine(RuleConfig{"cypress/no-debug": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-debug" {
    t.Fatalf("want one no-debug finding, got %v", got)
  }
}
