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
func TestNoDuplicateImportsTreatsDefaultWithEmptyNamedClauseAsDefault(t *testing.T) {
  got := runNoDuplicateImports(t, `export * from "m";
import def, {} from "m";
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
