package linthost

import "testing"

// TestBoundariesElementTypesNamesTheAllowedSet verifies that when an
// element-types rule denies an import by way of an allow-list, the message names
// what the list permits.
//
// A rejection should identify the configured alternatives rather than require
// the reader to open lint.config. This entry checks the authored singleton set
// in the same finding that rejects the domain import.
//
// 1. Allow `app` to import only `shared`.
// 2. Import `domain`, which the allow-list excludes.
// 3. Assert the finding names `shared` as what is allowed.
//
// @evidence contracts/testing.md#behavioral-verification The element-types rejection names shared as the allowed target set.
// @evidence contracts/testing.md#independent-expectations The authored allow shared policy rejects domain and provides the independent literal Allowed here: shared message oracle.
// @evidence contracts/testing.md#distinguishing-cases Allow-list denial differs from the deny-only sibling, which requires no allowed-set clause.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run for the authored app allow-shared policy. The entry owns both assertSingleBoundaryFinding message checks on its one finding.
func TestBoundariesElementTypesNamesTheAllowedSet(t *testing.T) {
  const ruleName = "boundaries/element-types"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", `
    import "../domain/internal";
  `, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**" },
      { "type": "shared", "pattern": "src/shared/**" }
    ],
    "rules": [
      { "from": "app", "allow": "shared" }
    ]
  }`, map[string]string{
    "src/domain/internal.ts": "export {};",
    "src/shared/util.ts":     "export {};",
  })
  assertSingleBoundaryFinding(t, ruleName, findings, `is not allowed in "app".`)
  assertSingleBoundaryFinding(t, ruleName, findings, `Allowed here: shared.`)
}
