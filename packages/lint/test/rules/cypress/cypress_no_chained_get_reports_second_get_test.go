package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoChainedGetReportsSecondGet verifies chained get detection.
//
// A later `.get()` restarts from the Cypress root instead of searching under the
// previous subject. The rule reports the second get in a Cypress chain.
//
//  1. Parse `cy.get(...).get(...)`.
//  2. Enable `cypress/no-chained-get`.
//  3. Assert the second get is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies get after another get produces one finding for cypress/no-chained-get; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations The second get restarts from the root instead of searching the previous subject. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases find searches the existing form subject and must be accepted. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoChainedGetReportsSecondGet is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoChainedGetReportsSecondGet(t *testing.T) {
  file := parseTS(t, `
    cy.get("form").get("button");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-chained-get": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-chained-get", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-chained-get" {
    t.Fatalf("want one no-chained-get finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-chained-get", "cy.get(\"form\").find(\"button\");\n")
}
