package linthost

import "testing"

// TestNoDuplicateImportsReportsSideEffectImportAfterNamedImport verifies
// no-duplicate-imports reports a bare side-effect import of a module
// that already has a named import above.
//
// Locks the cross-category mergeability of the side-effect shape: the
// module already loads through the named declaration, so the bare
// `import "m"` folds into it. The official mergeability table exempts
// the side-effect category from every exclusion, and this pins that the
// port did not accidentally isolate it.
//
// 1. Import named bindings from "m", then a bare `import "m"`.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
func TestNoDuplicateImportsReportsSideEffectImportAfterNamedImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { named } from "m";
import "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
