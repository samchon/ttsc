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
func TestCypressAssertionBeforeScreenshotReportsUncheckedScreenshot(t *testing.T) {
  file := parseTS(t, `
    cy.screenshot();
  `)
  findings := NewEngine(RuleConfig{"cypress/assertion-before-screenshot": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/assertion-before-screenshot" {
    t.Fatalf("want one assertion-before-screenshot finding, got %v", got)
  }
}
