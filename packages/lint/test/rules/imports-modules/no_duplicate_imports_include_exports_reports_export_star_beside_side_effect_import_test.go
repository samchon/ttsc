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
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Export-all and side-effect imports report as mergeable in both declaration orders. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The authored messages identify export-as-import at line 2 and import-as-export at line 4, independently of emission order. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Both m and n orderings complement nonmergeable export-all/named acceptance.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
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
