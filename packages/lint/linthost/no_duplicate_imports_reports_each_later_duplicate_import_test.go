package linthost

import "testing"

// TestNoDuplicateImportsReportsEachLaterDuplicateImport verifies three
// mergeable imports of one module produce a finding on the second AND
// the third declaration.
//
// Locks one finding per later declaration, rather than one finding for the
// module or one per earlier pairing. Each later named import can already
// merge with the first, so this fixture does not prove reported declarations
// remain recorded for comparisons with different declaration categories.
//
// 1. Import named bindings from the same module three times.
// 2. Run the rule with default options.
// 3. Assert duplicate-import findings on lines two and three.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Three named imports report both the second and third declarations. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Both later declarations duplicate the first module operation; the authored two-entry list detects lost or extra reports. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Repeated history must produce one report per later import, not one total or one per earlier pair.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsEachLaterDuplicateImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "m";
import { second } from "m";
import { third } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
    {Line: 3, Message: "`m` import is duplicated."},
  })
}
