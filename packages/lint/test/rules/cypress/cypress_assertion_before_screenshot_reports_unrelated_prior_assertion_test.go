package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressAssertionBeforeScreenshotReportsUnrelatedPriorAssertion verifies stale assertion state.
//
// A previous `.should()` must not bless every later screenshot in the file.
// The intervening Cypress command makes the assertion unrelated to the
// screenshot, so only the immediately preceding statement counts.
//
//  1. Parse an assertion, an intervening Cypress command, and `cy.screenshot()`.
//  2. Enable `cypress/assertion-before-screenshot`.
//  3. Assert the screenshot command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/assertion-before-screenshot enabled runs over a should assertion on the dialog, then `cy.get("[data-cy=menu]");`, then `cy.screenshot();`; the test requires exactly one finding, rule cypress/assertion-before-screenshot at error severity (assertCypressOrdinaryRuleErrors), registered as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations An assertion on the dialog that is separated from the screenshot by another command does not establish the state captured afterward; the expected count of one is a literal authored from that policy.
// @evidence contracts/testing.md#distinguishing-cases Positive case whose earlier assertion is not the immediately preceding statement: the intervening cy.get makes the previous statement a non-assertion. The adjacent-assertion test owns the accepted case where the assertion is immediately before.
// @evidence contracts/testing.md#execution-ownership TestCypressAssertionBeforeScreenshotReportsUnrelatedPriorAssertion is an in-process Go unit test: parseTS plus NewEngine(...).Run over the source. It installs no Cypress, starts no browser and no product host.
func TestCypressAssertionBeforeScreenshotReportsUnrelatedPriorAssertion(t *testing.T) {
  file := parseTS(t, `
    cy.get("[data-cy=dialog]").should("be.visible");
    cy.get("[data-cy=menu]");
    cy.screenshot();
  `)
  findings := NewEngine(RuleConfig{"cypress/assertion-before-screenshot": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/assertion-before-screenshot", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/assertion-before-screenshot" {
    t.Fatalf("want one assertion-before-screenshot finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
