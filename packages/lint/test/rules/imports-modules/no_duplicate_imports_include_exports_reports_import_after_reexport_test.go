package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsImportAfterReexport
// verifies `includeExports: true` reports an import of a module that was
// already re-exported above.
//
// Locks the import-versus-exports pairing (the official `importAs`
// message): the import handler additionally compares against recorded
// re-exports when the option is on, and the finding carries the
// duplicated-as-export message. With the option off, the earlier
// re-export would never have been recorded and this import would pass.
//
// 1. Re-export named bindings from "m", then import from "m".
// 2. Run the rule with `includeExports: true`.
// 3. Assert exactly one duplicated-as-export finding on the second line.
func TestNoDuplicateImportsIncludeExportsReportsImportAfterReexport(t *testing.T) {
  got := runNoDuplicateImports(t, `export { thing } from "m";
import { value } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated as export."},
  })
}
