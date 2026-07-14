package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestCypressNoAsyncTestsReportsAsyncIt verifies async test callback detection.
//
// Cypress test callbacks should not be async because Cypress commands already
// manage their own queue. The rule checks Mocha test calls and reports the
// async function argument directly.
//
//  1. Parse an `it` call with an async arrow callback.
//  2. Enable `cypress/no-async-tests`.
//  3. Assert the async test callback is reported once.
func TestCypressNoAsyncTestsReportsAsyncIt(t *testing.T) {
  file := parseTS(t, `
    it("saves", async () => {
      await cy.get("button");
    });
  `)
  findings := NewEngine(RuleConfig{"cypress/no-async-tests": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "cypress/no-async-tests" {
    t.Fatalf("want one no-async-tests finding, got %v", got)
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
