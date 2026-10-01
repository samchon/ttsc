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
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. An empty reexport after export-all is a duplicate export. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations export {} from m still carries a module operation with side-effect shape; the authored line-2 message distinguishes empty clause classification. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Contrasts empty reexport with namespace reexport acceptance, while default with empty clause is separately not side-effect-only.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsTreatsEmptyReexportClauseAsSideEffect(t *testing.T) {
  got := runNoDuplicateImports(t, `export * from "m";
export {} from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated."},
  })
}
