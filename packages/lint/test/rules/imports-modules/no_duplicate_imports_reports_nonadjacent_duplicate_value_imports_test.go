package linthost

import "testing"

// TestNoDuplicateImportsReportsNonadjacentDuplicateValueImports verifies
// no-duplicate-imports reports a duplicate even when an unrelated import
// sits between the two same-module declarations.
//
// Locks the per-module bookkeeping in the rule's `modules` map: the
// duplicate comparison keys on the module specifier, not on adjacency,
// so an intervening import of a different module must neither reset the
// tracking nor produce a finding of its own.
//
// 1. Import from "m", then from an unrelated module, then from "m" again.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the third line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. An unrelated intervening module does not hide the later duplicate at line 3. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Duplicate identity is module-based across the source, not adjacency-based; the authored line and m message fix that expectation. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases The other-module middle statement is a negative control and a state-retention boundary.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsNonadjacentDuplicateValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "m";
import { other } from "other";
import { second } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 3, Message: "`m` import is duplicated."},
  })
}
