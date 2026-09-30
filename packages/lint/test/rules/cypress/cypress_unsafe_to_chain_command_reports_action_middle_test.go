package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressUnsafeToChainCommandReportsActionMiddle verifies unsafe action chaining.
//
// Cypress action commands should end a chain because the yielded subject may no
// longer be safe to reuse. This pins the parent-chain check for an action call
// followed by another Cypress command.
//
//  1. Parse a chain with `.type()` followed by another `.type()`.
//  2. Enable `cypress/unsafe-to-chain-command`.
//  3. Assert the first action command is reported once.
//
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies type followed by type produces one finding for cypress/unsafe-to-chain-command; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations An action can invalidate the current subject, so another chained command cannot safely reuse it. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases A terminal type action has no following command that reuses the subject. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressUnsafeToChainCommandReportsActionMiddle is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
func TestCypressUnsafeToChainCommandReportsActionMiddle(t *testing.T) {
  file := parseTS(t, `
    cy.get("input").type("a").type("b");
  `)
  findings := NewEngine(RuleConfig{"cypress/unsafe-to-chain-command": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/unsafe-to-chain-command", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/unsafe-to-chain-command" {
    t.Fatalf("want one unsafe-to-chain-command finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/unsafe-to-chain-command", "cy.get(\"input\").type(\"a\");\n")
}
