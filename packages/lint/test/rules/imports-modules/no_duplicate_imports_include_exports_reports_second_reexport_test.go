package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsSecondReexport verifies
// `includeExports: true` reports the second of two mergeable named
// re-exports of the same module.
//
// Locks the export-versus-exports pairing (the official `export`
// message): two `export { … } from "m"` declarations consolidate into
// one, making the second a plain export duplicate with its own message
// distinct from the cross-kind duplicated-as-import case.
//
// 1. Re-export named bindings from the same module twice.
// 2. Run the rule with `includeExports: true`.
// 3. Assert exactly one duplicated-export finding on the second line.
func TestNoDuplicateImportsIncludeExportsReportsSecondReexport(t *testing.T) {
  got := runNoDuplicateImports(t, `export { first } from "m";
export { second } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated."},
  })
}
