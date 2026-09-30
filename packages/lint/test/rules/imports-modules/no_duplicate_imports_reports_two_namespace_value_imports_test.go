package linthost

import "testing"

// TestNoDuplicateImportsReportsTwoNamespaceValueImports verifies
// no-duplicate-imports reports two namespace imports of the same module.
//
// Positive twin of the namespace/named exclusion: the guard in
// `duplicateImportsCanMerge` only excludes namespace-beside-named pairs,
// while two namespace bindings of one module remain an ordinary
// duplicate (one binding can serve both call sites). An over-broad
// namespace exemption would silently stop reporting this shape.
//
// 1. Import `* as a` and `* as b` from the same module.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Two same-module namespace value imports report the second. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Namespace aliases do not require two module operations; the authored exact duplicate message is independent of alias spelling. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Contrasts two namespace clauses with named/namespace forms that cannot share one declaration.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsTwoNamespaceValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import * as first from "m";
import * as second from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
