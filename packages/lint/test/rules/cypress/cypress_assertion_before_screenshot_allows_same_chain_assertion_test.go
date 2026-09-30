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
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies should followed by screenshot in the same fluent chain produces zero findings for cypress/assertion-before-screenshot; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations The screenshot receiver includes the assertion that establishes its captured state. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases Nested AST visitation order must not misclassify this same-chain assertion; the adjacent-statement test owns the other accepted shape.
// @evidence contracts/testing.md#execution-ownership TestCypressAssertionBeforeScreenshotAllowsSameChainAssertion is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
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
