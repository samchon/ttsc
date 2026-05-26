package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoAndReportsChainStartingAnd verifies assertion chain starter detection.
//
// `.and()` reads naturally after an assertion but is unclear as the first
// assertion method. This pins the previous-method check for a selector followed
// directly by `.and()`.
//
//  1. Parse `cy.get(...).and(...)`.
//  2. Enable `cypress/no-and`.
//  3. Assert the chain-starting `.and()` is reported once.
func TestCypressNoAndReportsChainStartingAnd(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").and("be.visible");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-and": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-and" {
    t.Fatalf("want one no-and finding, got %v", got)
  }
}
