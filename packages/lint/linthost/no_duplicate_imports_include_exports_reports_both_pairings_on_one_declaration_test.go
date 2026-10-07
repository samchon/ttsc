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
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. One later reexport reports both its earlier import pairing and earlier export pairing. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The authored three (line,message) entries require separate import/export message kinds, including two reports at line 3. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Import then two reexports exposes first-match suppression and duplicate cardinality; default export omission is separately covered.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
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
