package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoDebugReportsDebugCommand verifies debug command detection.
//
// `cy.debug()` changes local runner behavior and is normally an accidental
// leftover. The rule must also catch the common chained form after a selector.
//
//  1. Parse `cy.get(...).debug()`.
//  2. Enable `cypress/no-debug`.
//  3. Assert the debug command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies a chained debug command produces one finding for cypress/no-debug; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations debug is an interactive debugging command rather than a test action. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases The same selector followed by a normal click has no debugging command. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoDebugReportsDebugCommand is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoDebugReportsDebugCommand(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").debug();
  `)
  findings := NewEngine(RuleConfig{"cypress/no-debug": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-debug", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-debug" {
    t.Fatalf("want one no-debug finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-debug", "cy.get(\"button\").click();\n")
}
