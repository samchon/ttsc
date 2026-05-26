package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressAssertionBeforeScreenshotAllowsImmediatelyPriorAssertion verifies adjacent assertions.
//
// A screenshot can intentionally validate the DOM in one Cypress command and
// capture it in the next command. This pins the separate-statement path so the
// rule does not require all valid assertions to live in the screenshot chain.
//
//  1. Parse a Cypress assertion statement followed by `cy.screenshot()`.
//  2. Enable `cypress/assertion-before-screenshot`.
//  3. Assert no finding is emitted.
func TestCypressAssertionBeforeScreenshotAllowsImmediatelyPriorAssertion(t *testing.T) {
  file := parseTS(t, `
    cy.get("[data-cy=dialog]").should("be.visible");
    cy.screenshot();
  `)
  findings := NewEngine(RuleConfig{"cypress/assertion-before-screenshot": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 0 {
    t.Fatalf("want no assertion-before-screenshot finding, got %v", got)
  }
}
