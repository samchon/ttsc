package linthost

import "testing"

// TestNoDuplicateImportsAllowSeparateTypeImportsStillReportsValuePairs
// verifies `allowSeparateTypeImports: true` keeps reporting two
// mergeable value imports of the same module.
//
// Negative twin of the option's acceptance case: the option only exempts
// pairs whose clause-level type-ness differs. Two value declarations
// remain in the ordinary comparison, so an over-broad option
// implementation that mutes every duplicate would fail here.
//
// 1. Import named value bindings from the same module twice.
// 2. Run the rule with `allowSeparateTypeImports: true`.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsAllowSeparateTypeImportsStillReportsValuePairs(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "m";
import { second } from "m";
`, `{"allowSeparateTypeImports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
