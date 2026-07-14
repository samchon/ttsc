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
