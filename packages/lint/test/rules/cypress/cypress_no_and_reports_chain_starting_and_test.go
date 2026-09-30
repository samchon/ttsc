package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoAndReportsChainStartingAnd verifies assertion chain starter detection.
//
// `.and()` reads naturally after an assertion but is unclear as the first
// assertion method. This pins the previous-method check for a selector followed
// directly by `.and()`.
//
//  1. Parse `cy.get(...).and(...)`.
//  2. Enable `cypress/no-and`.
//  3. Assert the chain-starting `.and()` is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies and as the first assertion method produces one finding for cypress/no-and; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations and extends an existing assertion rather than starting a new assertion chain. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases A should assertion before and supplies the missing predecessor. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoAndReportsChainStartingAnd is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoAndReportsChainStartingAnd(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").and("be.visible");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-and": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-and", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-and" {
    t.Fatalf("want one no-and finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-and", "cy.get(\"button\").should(\"be.visible\").and(\"be.enabled\");\n")
}
