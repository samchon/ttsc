package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoForceReportsForceTrueOption verifies forced action detection.
//
// `{ force: true }` on Cypress actions bypasses actionability checks. The rule
// should find the option object even when it appears inside a longer chain.
//
//  1. Parse a chained click with `{ force: true }`.
//  2. Enable `cypress/no-force`.
//  3. Assert the forced action is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies a chained click with force true produces one finding for cypress/no-force; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations force true bypasses actionability checks. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases force false keeps the checks active on the same action. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoForceReportsForceTrueOption is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressNoForceReportsForceTrueOption(t *testing.T) {
  file := parseTS(t, `
    cy.get("button").click({ force: true });
  `)
  findings := NewEngine(RuleConfig{"cypress/no-force": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-force", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-force" {
    t.Fatalf("want one no-force finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-force", "cy.get(\"button\").click({ force: false });\n")
}
