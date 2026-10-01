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
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/assertion-before-screenshot enabled runs over `cy.get("[data-cy=dialog]").should("be.visible");` followed by the separate statement `cy.screenshot();`; the test requires zero findings (findingRules is empty).
// @evidence contracts/testing.md#independent-expectations A screenshot whose immediately preceding statement ends in a should assertion has a checked DOM state; the zero count is a literal authored from that policy.
// @evidence contracts/testing.md#distinguishing-cases Negative-for-the-rule case: the assertion sits in the previous statement, not in the screenshot chain. The same-chain test owns the other accepted shape, and the unchecked and unrelated-prior tests own the reported shapes.
// @evidence contracts/testing.md#execution-ownership TestCypressAssertionBeforeScreenshotAllowsImmediatelyPriorAssertion is an in-process Go unit test: parseTS plus NewEngine(...).Run over the source. It installs no Cypress, starts no browser and no product host.
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
