package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressRequireDataSelectorsReportsClassSelector verifies data selector enforcement.
//
// `cy.get` selectors that depend on classes are brittle against styling changes.
// The rule reports statically known selector strings that do not start with a
// `data-*` attribute selector.
//
//  1. Parse `cy.get(".submit")`.
//  2. Enable `cypress/require-data-selectors`.
//  3. Assert the class selector is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies a class selector produces one finding for cypress/require-data-selectors; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations The policy requires stable data attributes instead of presentation classes. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases A data-cy selector satisfies that selector policy. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressRequireDataSelectorsReportsClassSelector is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressRequireDataSelectorsReportsClassSelector(t *testing.T) {
  file := parseTS(t, `
    cy.get(".submit").click();
  `)
  findings := NewEngine(RuleConfig{"cypress/require-data-selectors": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/require-data-selectors", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/require-data-selectors" {
    t.Fatalf("want one require-data-selectors finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/require-data-selectors", "cy.get(\"[data-cy=submit]\").click();\n")
}
