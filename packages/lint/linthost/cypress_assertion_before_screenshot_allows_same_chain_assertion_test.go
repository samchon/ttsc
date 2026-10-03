package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressAssertionBeforeScreenshotAllowsSameChainAssertion verifies same-chain assertions.
//
// The rule visits each `screenshot` call and inspects its receiver chain for a
// `.should()` or `.and()` call, so a valid same-chain assertion is not reported.
//
//  1. Parse `cy.get(...).should(...).screenshot()`.
//  2. Enable `cypress/assertion-before-screenshot`.
//  3. Assert no finding is emitted.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/assertion-before-screenshot enabled runs over `cy.get("[data-cy=dialog]").should("be.visible").screenshot();`; the test requires zero findings (findingRules is empty).
// @evidence contracts/testing.md#independent-expectations A screenshot whose receiver chain already contains a should assertion has a checked DOM state; the zero count is a literal authored from that policy.
// @evidence contracts/testing.md#distinguishing-cases Accepted case where the assertion is in the same fluent chain as the screenshot call (previousChainHasAnyMethod over the receiver); the adjacent-statement test owns the other accepted shape.
// @evidence contracts/testing.md#execution-ownership TestCypressAssertionBeforeScreenshotAllowsSameChainAssertion is an in-process Go unit test: parseTS plus NewEngine(...).Run over the source. It installs no Cypress, starts no browser and no product host.
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
