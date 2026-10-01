package linthost

import "testing"

// TestBoundariesDependenciesFiltersPoliciesByLegacyImportKind verifies the
// deprecated policy-level `importKind` filter and its selector precedence.
//
// Upstream keeps `importKind` as a policy-wide dependency-kind gate that a
// selector-level `dependency.kind` overrides. Dropping the gate would deny
// value imports under type-only policies; inverting the precedence would make
// explicit selector kinds unreachable.
//
// 1. Import one type-only and one value dependency from an app file.
// 2. Deny domain under `importKind: "type"`, then with a `kind: "value"` selector.
// 3. Assert the first run reports only the type import and the second only the value import.
//
// @evidence contracts/testing.md#behavioral-verification Legacy importKind selects the type edge, but a nested dependency kind selector takes precedence and selects the value edge.
// @evidence contracts/testing.md#independent-expectations The explicitly authored policy alternatives establish which source edge each contract form denotes; literal types/value targets are not engine-generated.
// @evidence contracts/testing.md#distinguishing-cases Same type and value imports under two policies distinguish inherited legacy filtering from the stronger nested selector.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run separately for the legacy type option and nested value override. This entry owns both literal expected targets in one Go unit.
func TestBoundariesDependenciesFiltersPoliciesByLegacyImportKind(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import type { Foo } from \"../domain/types\";\nimport { value } from \"../domain/value\";\nvoid value;\n"
  files := map[string]string{
    "src/domain/types.ts": "export interface Foo {}",
    "src/domain/value.ts": "export const value = 1;",
  }
  elements := `"elements":[
    {"type":"app","pattern":"src/app/**"},
    {"type":"domain","pattern":"src/domain/**"}
  ],"default":"allow"`

  typeOnly := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+elements+`,
    "policies":[{"from":"app","importKind":"type","disallow":"domain"}]
  }`, files)
  assertBoundaryFindingTexts(t, source, typeOnly, `"../domain/types"`)

  selectorWins := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+elements+`,
    "policies":[{
      "from":"app",
      "importKind":"type",
      "disallow":{"to":"domain","dependency":{"kind":"value"}}
    }]
  }`, files)
  assertBoundaryFindingTexts(t, source, selectorWins, `"../domain/value"`)
}
