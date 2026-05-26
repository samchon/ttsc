package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressAssertionBeforeScreenshotAllowsSameChainAssertion verifies same-chain assertions.
//
// The tsgo visitor can encounter the outer `.screenshot()` call before the
// inner `.should()` call in a fluent chain. The rule sorts call expressions and
// also inspects the receiver chain so a valid same-chain assertion is not
// reported.
//
//  1. Parse `cy.get(...).should(...).screenshot()`.
//  2. Enable `cypress/assertion-before-screenshot`.
//  3. Assert no finding is emitted.
func TestCypressAssertionBeforeScreenshotAllowsSameChainAssertion(t *testing.T) {
  file := parseTS(t, `
    cy.get("[data-cy=dialog]").should("be.visible").screenshot();
  `)
  findings := NewEngine(RuleConfig{"cypress/assertion-before-screenshot": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 0 {
    t.Fatalf("want no assertion-before-screenshot finding, got %v", got)
  }
}
