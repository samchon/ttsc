package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsExportStarBesideSideEffectImport
// verifies `includeExports: true` pairs `export * from "m"` with a bare
// side-effect import of "m" as duplicates, in both declaration orders.
//
// Locks the side-effect carve-out inside the export-all exclusion: the
// official guard blocks export-all only against binding forms, and a
// bare `import "m"` is subsumed by the module load `export *` already
// performs. The first order yields the export message pair, the reverse
// order the import message pair, pinning both report arms.
//
//  1. `import "m"` then `export * from "m"`; `export * from "n"` then
//     `import "n"`.
//  2. Run the rule with `includeExports: true`.
//  3. Assert one duplicated-as-import finding on line 2 and one
//     duplicated-as-export finding on line 4.
func TestNoDuplicateImportsIncludeExportsReportsExportStarBesideSideEffectImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import "m";
export * from "m";
export * from "n";
import "n";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated as import."},
    {Line: 4, Message: "`n` import is duplicated as export."},
  })
}
