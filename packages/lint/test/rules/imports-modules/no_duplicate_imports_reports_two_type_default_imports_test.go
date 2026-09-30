package linthost

import "testing"

// TestNoDuplicateImportsReportsTwoTypeDefaultImports verifies two
// type-only default imports of the same module are still reported.
//
// Positive twin of the ESLint 9.30.1 exemption: the type-only guard in
// `duplicateImportsCanMerge` excludes only the default/named pairing.
// Two type-only defaults reference the same export and reduce to one
// declaration, so widening the guard to every type-only pair would be a
// regression this case catches.
//
// 1. Import two type-only default bindings from the same module.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Two type-only default imports of the same module report the second. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Both bind the same default type and are redundant; the authored line-2 duplicate differs from incompatible type default/named acceptance. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Same-category default pair guards against exempting all type-only imports.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsTwoTypeDefaultImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import type First from "m";
import type Second from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
