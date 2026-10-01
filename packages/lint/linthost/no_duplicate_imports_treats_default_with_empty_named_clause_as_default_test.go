package linthost

import "testing"

// TestNoDuplicateImportsTreatsDefaultWithEmptyNamedClauseAsDefault
// verifies `import def, {} from "m"` is categorized as a default import,
// not as a side-effect import.
//
// Locks the fall-through order in `duplicateImportsImportEntry`: an
// empty named block contributes no specifiers, so the default binding
// decides the category — mirroring the official specifier scan that
// falls back to `specifiers[0]`. The discriminating pairing is an
// earlier `export * from "m"`: a default binding cannot merge with
// export-all (silence), while a miscategorized side-effect import would
// merge and report.
//
// 1. Write `export * from "m"`, then `import def, {} from "m"`.
// 2. Run the rule with `includeExports: true`.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. A default import with an empty named clause remains nonmergeable with export-all. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The existing default binding prevents the declaration being side-effect-only; TypeScript binding shape establishes zero findings. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Contrasts bare empty named clauses and empty reexports, which are separately tested as side-effect forms.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsTreatsDefaultWithEmptyNamedClauseAsDefault(t *testing.T) {
  got := runNoDuplicateImports(t, `export * from "m";
import def, {} from "m";
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
