package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressAssertionBeforeScreenshotReportsUnrelatedPriorAssertion verifies stale assertion state.
//
// A previous `.should()` must not bless every later screenshot in the file.
// The intervening Cypress command makes the assertion unrelated to the
// screenshot, covering the regression where a file-global flag hid the report.
//
//  1. Parse an assertion, an intervening Cypress command, and `cy.screenshot()`.
//  2. Enable `cypress/assertion-before-screenshot`.
//  3. Assert the screenshot command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies a screenshot after an intervening get produces one finding for cypress/assertion-before-screenshot; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations An assertion for dialog cannot establish the menu state accessed afterward. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases The intervening command invalidates the immediately-prior assertion condition; the adjacent-assertion case distinguishes accepted state.
// @evidence contracts/testing.md#execution-ownership TestCypressAssertionBeforeScreenshotReportsUnrelatedPriorAssertion is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
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
