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
func TestNoDuplicateImportsIncludeExportsReportsTypeReexportAfterValueImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export type { IEntity } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated as import."},
  })
}
