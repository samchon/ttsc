package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressAssertionBeforeScreenshotReportsUncheckedScreenshot verifies screenshot assertion ordering.
//
// Screenshots without a prior Cypress assertion can capture race-dependent UI
// state. The rule reports a screenshot whose receiver chain has no `.should()`
// or `.and()` and whose previous sibling statement is not an assertion call.
//
//  1. Parse a file that calls `cy.screenshot()` first.
//  2. Enable `cypress/assertion-before-screenshot`.
//  3. Assert the screenshot command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/assertion-before-screenshot enabled runs over `cy.screenshot();` alone; the test requires exactly one finding, rule cypress/assertion-before-screenshot at error severity (assertCypressOrdinaryRuleErrors), registered as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations A screenshot with no assertion in its chain and no preceding statement captures unchecked DOM state; the expected count of one is a literal authored from that policy.
// @evidence contracts/testing.md#distinguishing-cases Positive case with an empty assertion history (no previous statement). The same-chain and adjacent-assertion tests own the accepted counterparts, and the unrelated-prior test owns the reported case that has an earlier but non-adjacent assertion.
// @evidence contracts/testing.md#execution-ownership TestCypressAssertionBeforeScreenshotReportsUncheckedScreenshot is an in-process Go unit test: parseTS plus NewEngine(...).Run over the source. It installs no Cypress, starts no browser and no product host.
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
