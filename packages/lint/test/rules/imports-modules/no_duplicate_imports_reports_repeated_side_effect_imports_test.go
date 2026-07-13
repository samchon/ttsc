package linthost

import "testing"

// TestNoDuplicateImportsReportsRepeatedSideEffectImports verifies
// no-duplicate-imports reports a second bare side-effect import of the
// same module.
//
// Locks the SideEffectImport category from `duplicateImportsImportEntry`
// on the clause-less shape: two `import "m"` declarations trivially
// consolidate into one, and the official implementation treats the
// side-effect category as mergeable with every import category.
//
// 1. Write the same bare `import "m"` twice.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsReportsRepeatedSideEffectImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import "m";
import "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
