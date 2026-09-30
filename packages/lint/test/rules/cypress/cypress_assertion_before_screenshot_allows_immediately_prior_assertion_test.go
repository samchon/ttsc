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
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies a should assertion directly before screenshot produces zero findings for cypress/assertion-before-screenshot; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations The screenshot has a preceding checked DOM state with no intervening command. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases The separate-statement success differs from the same-chain success and intervening-command rejection cases.
// @evidence contracts/testing.md#execution-ownership TestCypressAssertionBeforeScreenshotAllowsImmediatelyPriorAssertion is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
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
