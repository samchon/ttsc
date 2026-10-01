package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoAsyncBeforeReportsAsyncBeforeEach verifies async hook callback detection.
//
// Async `before` hooks mix promise lifecycles with Cypress command queues. The
// rule covers both `before` and `beforeEach`, including function-expression
// callbacks.
//
//  1. Parse a `beforeEach` call with an async function callback.
//  2. Enable `cypress/no-async-before`.
//  3. Assert the async hook callback is reported once.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine with only cypress/no-async-before enabled runs over `beforeEach(async function () { await cy.get("button"); });`; the test requires exactly one finding whose rule is cypress/no-async-before at error severity (assertCypressOrdinaryRuleErrors rejects engine-failure or other-severity findings) and registers it as an engine behavioral witness.
// @evidence contracts/testing.md#independent-expectations Cypress hooks queue commands and must not mix in an async promise lifecycle, so an async function callback to beforeEach is wrong. The expected count of one and the zero-finding control are literals authored from that rule contract, not computed by the rule.
// @evidence contracts/testing.md#distinguishing-cases Positive: `beforeEach(async function () { await cy.get("button"); });` yields one finding. Negative control: `beforeEach(function () { cy.get("button"); });` is run through assertRuleSkipsSource and must yield zero findings; the same hook with a synchronous function callback is accepted.
// @evidence contracts/testing.md#execution-ownership TestCypressNoAsyncBeforeReportsAsyncBeforeEach is an in-process Go unit test: parseTS plus NewEngine(...).Run for the positive case and runRuleFindingsSnapshot (via assertRuleSkipsSource) for the control. It installs no Cypress, starts no browser and no product host.
func TestCypressNoAsyncBeforeReportsAsyncBeforeEach(t *testing.T) {
  file := parseTS(t, `
    beforeEach(async function () {
      await cy.get("button");
    });
  `)
  findings := NewEngine(RuleConfig{"cypress/no-async-before": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  assertCypressOrdinaryRuleErrors(t, "cypress/no-async-before", findings)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-async-before" {
    t.Fatalf("want one no-async-before finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "cypress/no-async-before", "beforeEach(function () { cy.get(\"button\"); });\n")
}
