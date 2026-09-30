package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressAssertionBeforeScreenshotReportsUncheckedScreenshot verifies screenshot assertion ordering.
//
// Screenshots without a prior Cypress assertion can capture race-dependent UI
// state. The rule walks the file in source order and reports screenshots that
// appear before any `.should()` or `.and()` assertion.
//
//  1. Parse a file that calls `cy.screenshot()` first.
//  2. Enable `cypress/assertion-before-screenshot`.
//  3. Assert the screenshot command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies a screenshot without an assertion produces one finding for cypress/assertion-before-screenshot; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations An unchecked screenshot has no asserted DOM state before capture. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases The empty assertion history is rejected; same-chain and immediately preceding assertions have separate accepted cases.
// @evidence contracts/testing.md#execution-ownership TestCypressAssertionBeforeScreenshotReportsUncheckedScreenshot is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressAssertionBeforeScreenshotReportsUncheckedScreenshot(t *testing.T) {
  file := parseTS(t, `
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
