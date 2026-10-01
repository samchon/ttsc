package linthost

import "testing"

// TestBoundariesElementTypesDenyOnlyNamesNothing is the negative twin.
//
// A deny-list has no allowed set — its complement is every other element — so
// the message must NOT sprout an "Allowed here" clause with nothing behind it.
// This is the boundary the empty-set guard exists for.
//
// 1. Disallow `app` from importing `domain`, with no allow-list.
// 2. Import `domain`.
// 3. Assert the finding fires and carries no allowed-set clause.
//
// @evidence contracts/testing.md#behavioral-verification The element-types rule rejects the denied domain edge but omits an Allowed here clause when no allow list exists.
// @evidence contracts/testing.md#independent-expectations A deny-only policy has no finite allowed set to display; independently authored message inclusion/exclusion fragments encode that contract.
// @evidence contracts/testing.md#distinguishing-cases Positive rejection is retained while the forbidden empty allowed-set clause is a negative output assertion; the allow-list message sibling owns the opposite case.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule executes NewEngineWithResolver.Run for the deny-only element-types policy. The entry owns assertSingleBoundaryFinding and assertBoundaryFindingExcludes for the same finding.
func TestBoundariesElementTypesDenyOnlyNamesNothing(t *testing.T) {
  const ruleName = "boundaries/element-types"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "../domain/internal";
  `, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**" }
    ],
    "rules": [
      { "from": "app", "disallow": "domain" }
    ]
  }`, map[string]string{
    "src/domain/internal.ts": "export {};",
  })
  assertSingleBoundaryFinding(t, ruleName, findings, `is not allowed in "app".`)
  assertBoundaryFindingExcludes(t, ruleName, findings, "Allowed here")
}
