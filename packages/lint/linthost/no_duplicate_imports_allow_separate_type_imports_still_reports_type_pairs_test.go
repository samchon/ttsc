package linthost

import "testing"

// TestNoDuplicateImportsAllowSeparateTypeImportsStillReportsTypePairs
// verifies `allowSeparateTypeImports: true` keeps reporting two
// mergeable clause-level type imports of the same module.
//
// Negative twin on the type side: the option separates the type category
// from the value category but does not exempt duplicates inside the type
// category — two named `import type` declarations merge into one. An
// implementation that skipped every type-only declaration under the
// option would fail here.
//
// 1. Import clause-level named type bindings from the same module twice.
// 2. Run the rule with `allowSeparateTypeImports: true`.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. The enabled separation option still reports two mergeable type-only named imports at line 2. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The option separates unlike categories, not duplicates within the type category; the exact duplicated-import message is authored. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Two type named clauses contrast with the mixed value/type acceptance case.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsAllowSeparateTypeImportsStillReportsTypePairs(t *testing.T) {
  got := runNoDuplicateImports(t, `import type { First } from "m";
import type { Second } from "m";
`, `{"allowSeparateTypeImports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
