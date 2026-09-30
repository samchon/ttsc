package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoPauseReportsPauseCommand verifies pause command detection.
//
// `cy.pause()` is useful while debugging locally but should not remain in specs
// committed to the project. The rule recognizes both root and chained Cypress
// calls through the same chain helper.
//
//  1. Parse a root `cy.pause()` command.
//  2. Enable `cypress/no-pause`.
//  3. Assert the pause command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies cy.pause produces one finding for cypress/no-pause; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations pause stops execution for interactive debugging. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases A normal selector command has no interactive pause. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoPauseReportsPauseCommand is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoPauseReportsPauseCommand(t *testing.T) {
  file := parseTS(t, `
    cy.pause();
  `)
  findings := NewEngine(RuleConfig{"cypress/no-pause": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-pause", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-pause" {
    t.Fatalf("want one no-pause finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-pause", "cy.get(\"button\");\n")
}
