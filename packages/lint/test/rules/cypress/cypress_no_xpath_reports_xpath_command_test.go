package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoXpathReportsXpathCommand verifies xpath command detection.
//
// Cypress XPath plugin support is deprecated. The rule flags the `cy.xpath`
// command so projects can migrate selectors to supported Cypress APIs.
//
//  1. Parse a `cy.xpath(...)` command.
//  2. Enable `cypress/no-xpath`.
//  3. Assert the xpath command is reported once.
func TestCypressNoXpathReportsXpathCommand(t *testing.T) {
  file := parseTS(t, `
    cy.xpath("//button");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-xpath": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-xpath" {
    t.Fatalf("want one no-xpath finding, got %v", got)
  }
}
