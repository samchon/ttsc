package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsReexportAfterImport
// verifies `includeExports: true` reports a named re-export of a module
// that already has a mergeable import above.
//
// Locks the export-versus-imports pairing (the official `exportAs`
// message): the re-export could be folded into the existing import plus
// a local `export`, so the pair is a duplicate across declaration kinds
// and carries the duplicated-as-import message rather than the plain
// export message.
//
// 1. Import named bindings from "m", then `export { … } from "m"`.
// 2. Run the rule with `includeExports: true`.
// 3. Assert exactly one duplicated-as-import finding on the second line.
func TestNoDuplicateImportsIncludeExportsReportsReexportAfterImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export { value } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated as import."},
  })
}
