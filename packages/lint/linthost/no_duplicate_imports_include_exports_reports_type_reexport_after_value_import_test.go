package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsTypeReexportAfterValueImport
// verifies `includeExports: true` alone still reports a clause-level
// `export type` re-export of a module with a value import above.
//
// Locks the default type handling on the export arm: without
// `allowSeparateTypeImports`, an `export type { … } from` declaration
// joins the ordinary comparison, and named type bindings merge with the
// named value import. This is the negative twin of the case that adds
// `allowSeparateTypeImports: true` and expects silence.
//
// 1. Import named value bindings from "m", then `export type { … } from "m"`.
// 2. Run the rule with `includeExports: true` only.
// 3. Assert exactly one duplicated-as-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Without type separation, a type reexport joins a preceding value import comparison. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations allowSeparateTypeImports defaults false; the authored line-2 export-as-import message is required despite type syntax. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Same fixture is exempt when both separation and export checking are enabled in the companion case.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsReportsTypeReexportAfterValueImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export type { IEntity } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated as import."},
  })
}
