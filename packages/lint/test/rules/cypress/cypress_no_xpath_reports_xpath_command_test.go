package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoXpathReportsXpathCommand verifies xpath command detection.
//
// Cypress XPath plugin support is deprecated. The rule flags the `cy.xpath`
// command so projects can migrate selectors to supported Cypress APIs.
//
//  1. Parse a `cy.xpath(...)` command.
//  2. Enable `cypress/no-xpath`.
//  3. Assert the xpath command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies cy.xpath produces one finding for cypress/no-xpath; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations The rule forbids the deprecated XPath command while permitting supported selector lookup. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases A CSS get call selects the button without XPath. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoXpathReportsXpathCommand is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoXpathReportsXpathCommand(t *testing.T) {
  file := parseTS(t, `
    cy.xpath("//button");
  `)
  findings := NewEngine(RuleConfig{"cypress/no-xpath": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-xpath", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-xpath" {
    t.Fatalf("want one no-xpath finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-xpath", "cy.get(\"button\");\n")
}
