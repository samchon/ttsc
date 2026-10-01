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
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/unsafe-to-chain-command enabled runs over `cy.get("input").type("a").type("b");`; the test requires exactly one finding whose rule is cypress/unsafe-to-chain-command at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations An action command (type) can invalidate the yielded subject, so a command chained after it is unsafe; only the first, non-terminal type call is reported (once). The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `cy.get("input").type("a").type("b");` yields one finding. Negative control: `cy.get("input").type("a");` is run through assertRuleSkipsSource and must yield zero findings; a terminal type with no following chained command is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressUnsafeToChainCommandReportsActionMiddle is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
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
