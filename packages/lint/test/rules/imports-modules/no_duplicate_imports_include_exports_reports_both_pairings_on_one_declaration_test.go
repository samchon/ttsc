package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsBothPairingsOnOneDeclaration
// verifies a re-export mergeable with an earlier re-export AND an
// earlier import produces both findings on the same declaration.
//
// Locks the two independent report arms in `reportDuplicateImports`: the
// official rule pushes one message per pairing kind, so the third
// declaration below carries the plain export duplicate and the
// duplicated-as-import finding simultaneously. Collapsing the arms into
// a single first-match report would drop one of them.
//
//  1. Import from "m", re-export from "m", then re-export from "m" again.
//  2. Run the rule with `includeExports: true`.
//  3. Assert the middle line reports duplicated-as-import and the last
//     line reports both pairings.
func TestNoDuplicateImportsIncludeExportsReportsBothPairingsOnOneDeclaration(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export { first } from "m";
export { second } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated as import."},
    {Line: 3, Message: "`m` export is duplicated as import."},
    {Line: 3, Message: "`m` export is duplicated."},
  })
}
