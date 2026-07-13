package linthost

import "testing"

// TestNoDuplicateImportsAllowSeparateTypeImportsStillReportsTypePairs
// verifies `allowSeparateTypeImports: true` keeps reporting two
// mergeable clause-level type imports of the same module.
//
// Negative twin on the type side: the option separates the type category
// from the value category but does not exempt duplicates inside the type
// category — two named `import type` declarations merge into one. An
// implementation that skipped every type-only declaration under the
// option would fail here.
//
// 1. Import clause-level named type bindings from the same module twice.
// 2. Run the rule with `allowSeparateTypeImports: true`.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsAllowSeparateTypeImportsStillReportsTypePairs(t *testing.T) {
  got := runNoDuplicateImports(t, `import type { First } from "m";
import type { Second } from "m";
`, `{"allowSeparateTypeImports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
