package linthost

import "testing"

// TestNoDuplicateImportsReportsDefaultThenNamespaceValueImports verifies
// no-duplicate-imports reports a namespace import following a default
// import of the same module.
//
// Locks the mergeable default/namespace pairing: `import def, * as ns
// from "m"` is legal TypeScript, so the two declarations consolidate and
// the second one is a duplicate. Guards against widening the
// namespace/named exclusion in `duplicateImportsCanMerge` to every
// namespace pairing.
//
// 1. Import a default binding and then a namespace binding from one module.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Default then namespace value imports report the second as a duplicate. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations TypeScript permits a default and namespace clause together; the authored line-2 message expresses that consolidation. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Differs from named/namespace acceptance even though both use a namespace binding.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsDefaultThenNamespaceValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import def from "m";
import * as namespace from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
