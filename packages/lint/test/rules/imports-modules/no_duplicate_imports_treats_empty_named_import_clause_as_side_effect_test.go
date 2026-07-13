package linthost

import "testing"

// TestNoDuplicateImportsTreatsEmptyNamedImportClauseAsSideEffect
// verifies `import {} from "m"` is categorized as a side-effect import,
// not as named bindings.
//
// Locks the empty-`NamedImports` branch in
// `duplicateImportsImportEntry`. In ESTree an empty block contributes no
// specifiers, so the official rule categorizes the declaration as
// SideEffectImport. The discriminating pairing is a preceding namespace
// import: side-effect merges with namespace (finding), while a
// miscategorized named clause would hit the namespace/named exclusion
// and stay silent.
//
// 1. Import `* as ns` from "m", then `import {} from "m"`.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsTreatsEmptyNamedImportClauseAsSideEffect(t *testing.T) {
  got := runNoDuplicateImports(t, `import * as namespace from "m";
import {} from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
