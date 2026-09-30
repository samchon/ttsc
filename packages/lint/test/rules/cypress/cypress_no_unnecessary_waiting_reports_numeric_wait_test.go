package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoUnnecessaryWaitingReportsNumericWait verifies arbitrary wait detection.
//
// Numeric `cy.wait` calls sleep for time rather than synchronizing on application
// state. Alias waits remain allowed because they are string selectors, not number
// literals.
//
//  1. Parse `cy.wait(250)`.
//  2. Enable `cypress/no-unnecessary-waiting`.
//  3. Assert the numeric wait is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies a numeric wait produces one finding for cypress/no-unnecessary-waiting; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations Numeric waits sleep for elapsed time; an alias waits for a known request event. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases A string alias wait is accepted instead of the numeric 250ms input. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoUnnecessaryWaitingReportsNumericWait is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoUnnecessaryWaitingReportsNumericWait(t *testing.T) {
  file := parseTS(t, `
    cy.wait(250);
  `)
  findings := NewEngine(RuleConfig{"cypress/no-unnecessary-waiting": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-unnecessary-waiting", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-unnecessary-waiting" {
    t.Fatalf("want one no-unnecessary-waiting finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-unnecessary-waiting", "cy.wait(\"@request\");\n")
}
