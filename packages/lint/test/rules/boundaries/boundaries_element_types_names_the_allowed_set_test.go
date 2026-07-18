package linthost

import "testing"

// TestBoundariesElementTypesNamesTheAllowedSet verifies that when an
// element-types rule denies an import by way of an allow-list, the message names
// what the list permits.
//
// The rule evaluates `allow` to decide, then throws it away and reports only
// that the import is forbidden — leaving the reader to open lint.config to learn
// what is permitted from here. This asserts the set is named instead.
//
// 1. Allow `app` to import only `shared`.
// 2. Import `domain`, which the allow-list excludes.
// 3. Assert the finding names `shared` as what is allowed.
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

// TestBoundariesElementTypesDenyOnlyNamesNothing is the negative twin.
//
// A deny-list has no allowed set — its complement is every other element — so
// the message must NOT sprout an "Allowed here" clause with nothing behind it.
// This is the boundary the empty-set guard exists for.
//
// 1. Disallow `app` from importing `domain`, with no allow-list.
// 2. Import `domain`.
// 3. Assert the finding fires and carries no allowed-set clause.
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
