package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoAssigningReturnValuesReportsCyAssignment verifies cy command assignment detection.
//
// Cypress commands enqueue work and do not return the eventual subject. Storing
// the return value is therefore misleading even when the TypeScript syntax is a
// normal const declaration.
//
//  1. Parse a Cypress spec that assigns `cy.get()` to a const.
//  2. Enable `cypress/no-assigning-return-values`.
//  3. Assert the assignment is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies assigning the cy.get chain produces one finding for cypress/no-assigning-return-values; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations A Cypress chain queues commands and is not the eventual DOM subject. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases Executing get without storing the chain removes the misleading assignment. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoAssigningReturnValuesReportsCyAssignment is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoAssigningReturnValuesReportsCyAssignment(t *testing.T) {
  file := parseTS(t, `
    const button = cy.get("button");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-assigning-return-values": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-assigning-return-values", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-assigning-return-values" {
    t.Fatalf("want one no-assigning-return-values finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-assigning-return-values", "cy.get(\"button\");\n")
}
