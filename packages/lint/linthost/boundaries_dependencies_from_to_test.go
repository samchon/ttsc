package linthost

import "testing"

// TestBoundariesDependenciesAppliesBothPolicyDirections verifies outer `from`
// and `to` selectors constrain an effect together.
//
// Treating `to` as another allow-list or ignoring it would make a policy meant
// for one edge affect every dependency from the source. The shared import is
// the one-property negative twin for the target direction.
//
//  1. Import domain and shared elements from the same app file.
//  2. Scope a source-pattern denial to the app-to-domain edge.
//  3. Assert only the domain import reports.
//  4. Widen the dependency path to `../**` so only the `to` selector separates
//     the two imports, and assert the domain import still alone reports.
//
// @evidence contracts/testing.md#behavioral-verification A policy jointly matches app source, domain target and domain dependency path without rejecting shared.
// @evidence contracts/testing.md#independent-expectations The authored from/to/dependency selectors are conjunctive, so only the literal domain import matches all predicates.
// @evidence contracts/testing.md#distinguishing-cases Two targets in one source distinguish joint direction/path matching from indiscriminate source rejection; the widened `../**` path isolates the `to` selector, which the narrow path alone cannot, since that path also excludes shared.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule feeds the authored source and fixture files to parseTSFile and NewEngineWithResolver.Run. This entry owns the domain-versus-shared selector comparison without a native host.
func TestBoundariesDependenciesAppliesBothPolicyDirections(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"../domain/model\";\nimport \"../shared/value\";\n"
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "elements": [
      {"type":"app","pattern":"src/app/**"},
      {"type":"domain","pattern":"src/domain/**"},
      {"type":"shared","pattern":"src/shared/**"}
    ],
    "default":"allow",
    "policies": [
      {
        "from":{"type":"app"},
        "to":{"type":"domain"},
        "disallow":{"dependency":{"source":"../domain/**"}}
      }
    ]
  }`, map[string]string{
    "src/domain/model.ts": "export {};",
    "src/shared/value.ts": "export {};",
  })
  assertBoundaryFindingTexts(t, source, findings, `"../domain/model"`)

  // The dependency path `../**` matches both imports, so only the `to`
  // selector can exclude the shared target: ignoring `to` would report both.
  toOnly := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "elements": [
      {"type":"app","pattern":"src/app/**"},
      {"type":"domain","pattern":"src/domain/**"},
      {"type":"shared","pattern":"src/shared/**"}
    ],
    "default":"allow",
    "policies": [
      {
        "from":{"type":"app"},
        "to":{"type":"domain"},
        "disallow":{"dependency":{"source":"../**"}}
      }
    ]
  }`, map[string]string{
    "src/domain/model.ts": "export {};",
    "src/shared/value.ts": "export {};",
  })
  assertBoundaryFindingTexts(t, source, toOnly, `"../domain/model"`)
}
