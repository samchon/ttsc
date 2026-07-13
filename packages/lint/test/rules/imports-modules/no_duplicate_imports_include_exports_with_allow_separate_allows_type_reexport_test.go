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
func TestNoDuplicateImportsIncludeExportsWithAllowSeparateAllowsTypeReexport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export type { IEntity } from "m";
`, `{"includeExports":true,"allowSeparateTypeImports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
