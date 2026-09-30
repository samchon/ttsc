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
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Two named reexports report the second as an export duplicate. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Named bindings from the same module can share one export declaration; the exact plain export message distinguishes mixed-kind pairings. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Named reexports complement export-all duplicates and the default ignore-exports case.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsReportsSecondReexport(t *testing.T) {
  got := runNoDuplicateImports(t, `export { first } from "m";
export { second } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated."},
  })
}
