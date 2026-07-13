package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsRepeatedExportStar verifies
// `includeExports: true` reports the second of two `export * from "m"`
// declarations.
//
// Positive twin of the export-all exclusion: the guard in
// `duplicateImportsCanMerge` only blocks export-all against binding
// forms; two identical `export *` declarations reduce to one and remain
// a duplicate. An over-broad exclusion that isolates export-all from
// everything would fail here.
//
// 1. Write `export * from "m"` twice.
// 2. Run the rule with `includeExports: true`.
// 3. Assert exactly one duplicated-export finding on the second line.
func TestNoDuplicateImportsIncludeExportsReportsRepeatedExportStar(t *testing.T) {
  got := runNoDuplicateImports(t, `export * from "m";
export * from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated."},
  })
}
