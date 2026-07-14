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
func TestCypressAssertionBeforeScreenshotReportsUnrelatedPriorAssertion(t *testing.T) {
  file := parseTS(t, `
    cy.get("[data-cy=dialog]").should("be.visible");
    cy.get("[data-cy=menu]");
    cy.screenshot();
  `)
  findings := NewEngine(RuleConfig{"cypress/assertion-before-screenshot": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/assertion-before-screenshot" {
    t.Fatalf("want one assertion-before-screenshot finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
