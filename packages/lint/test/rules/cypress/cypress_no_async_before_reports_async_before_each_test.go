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
// @evidence contracts/testing.md#behavioral-verification The actual NewEngine.Run verifies an async function beforeEach callback produces one finding for cypress/no-async-before; findingRules asserts the complete count and rule identity, so this does not check repository metadata.
// @evidence contracts/testing.md#independent-expectations Cypress hooks use the command queue, not an async promise lifecycle. The expected rule and count are independently authored for that policy rather than read from engine output.
// @evidence contracts/testing.md#distinguishing-cases A synchronous function callback queues the same get without mixing async lifecycles. Both the original reported source and an independently authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestCypressNoAsyncBeforeReportsAsyncBeforeEach is a public Go unit entry parsing Cypress-shaped TypeScript and running the owning engine in-process; it does not install Cypress, start a browser or run a product host.
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
