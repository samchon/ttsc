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
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-assigning-return-values enabled runs over `const button = cy.get("button");`; the test requires exactly one finding whose rule is cypress/no-assigning-return-values at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations Cypress commands enqueue work and do not yield their subject synchronously, so a variable initialized from a cy chain is misleading. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `const button = cy.get("button");` yields one finding. Negative control: `cy.get("button");` is run through assertRuleSkipsSource and must yield zero findings; the identical command as a bare statement without a variable is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressNoAssigningReturnValuesReportsCyAssignment is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
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
