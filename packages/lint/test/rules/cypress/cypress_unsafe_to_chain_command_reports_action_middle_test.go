package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressUnsafeToChainCommandReportsActionMiddle verifies unsafe action chaining.
//
// Cypress action commands should end a chain because the yielded subject may no
// longer be safe to reuse. This pins the parent-chain check for an action call
// followed by another Cypress command.
//
//  1. Parse a chain with `.type()` followed by another `.type()`.
//  2. Enable `cypress/unsafe-to-chain-command`.
//  3. Assert the first action command is reported once.
func TestCypressUnsafeToChainCommandReportsActionMiddle(t *testing.T) {
  file := parseTS(t, `
    cy.get("input").type("a").type("b");
  `)
  findings := NewEngine(RuleConfig{"cypress/unsafe-to-chain-command": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/unsafe-to-chain-command" {
    t.Fatalf("want one unsafe-to-chain-command finding, got %v", got)
  }
}
