package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsWithAllowSeparateAllowsTypeReexport
// verifies combining `includeExports` with `allowSeparateTypeImports`
// accepts a clause-level `export type` re-export next to a value import
// of the same module.
//
// Locks the clause-level type-ness reading on the export arm
// (`ExportDeclaration.IsTypeOnly`): the type/value separation must apply
// to re-exports exactly as it does to imports, so the type-only
// re-export is exempt from comparison with the value import. If export
// type-ness were dropped, this pair would report as its
// includeExports-only twin does.
//
// 1. Import named value bindings from "m", then `export type { … } from "m"`.
// 2. Run the rule with both options enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. The combined export and type-separation options exempt a value import/type reexport pair. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Unlike clause-level categories are exempt under allowSeparateTypeImports even across import/export declarations. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases The same pair reports in the no-separation sibling, isolating the option interaction.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsWithAllowSeparateAllowsTypeReexport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export type { IEntity } from "m";
`, `{"includeExports":true,"allowSeparateTypeImports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
