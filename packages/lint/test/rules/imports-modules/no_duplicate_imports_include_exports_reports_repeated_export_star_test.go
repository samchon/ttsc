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
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Two export-all declarations report the second as an export duplicate. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Identical export-all operations can be consolidated; the authored line-2 plain export message follows the declaration kinds. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Same-kind export-all positive contrasts with export-all/namespace negative and mixed import/export messages.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsReportsRepeatedExportStar(t *testing.T) {
  got := runNoDuplicateImports(t, `export * from "m";
export * from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated."},
  })
}
