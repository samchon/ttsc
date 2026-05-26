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
func TestCypressNoAsyncBeforeReportsAsyncBeforeEach(t *testing.T) {
  file := parseTS(t, `
    beforeEach(async function () {
      await cy.get("button");
    });
  `)
  findings := NewEngine(RuleConfig{"cypress/no-async-before": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-async-before" {
    t.Fatalf("want one no-async-before finding, got %v", got)
  }
}
