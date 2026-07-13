package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsTreatsEmptyReexportClauseAsSideEffect
// verifies `export {} from "m"` is categorized as a specifier-less
// side-effect declaration, not as named bindings.
//
// Locks the empty-`NamedExports` branch in
// `duplicateImportsExportEntry`, mirroring the ESTree reading where an
// empty block contributes no specifiers. The discriminating pairing is a
// preceding `export * from "m"`: the side-effect category merges with
// export-all (finding), while miscategorized named bindings would hit
// the export-all exclusion and stay silent.
//
// 1. Write `export * from "m"` and then `export {} from "m"`.
// 2. Run the rule with `includeExports: true`.
// 3. Assert exactly one duplicated-export finding on the second line.
func TestNoDuplicateImportsIncludeExportsTreatsEmptyReexportClauseAsSideEffect(t *testing.T) {
  got := runNoDuplicateImports(t, `export * from "m";
export {} from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated."},
  })
}
