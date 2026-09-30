package linthost

import "testing"

// TestNoDuplicateImportsReportsDefaultThenNamedValueImports verifies
// no-duplicate-imports reports a named value import following a default
// value import of the same module.
//
// Locks the mergeable cross-category pairing in
// `duplicateImportsCanMerge`: a default binding and named bindings share
// one legal declaration (`import def, { a } from "m"`), so the pair is a
// duplicate even though the categories differ. This is the value-kind
// negative twin of the type-only default/named exemption, which must not
// leak into value declarations.
//
// 1. Import a default binding and then named bindings from one module.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Default then named value imports report the second as a duplicate. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations TypeScript permits one declaration with default and named bindings; the authored line-2 message follows mergeability. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Contrasts with type-only default/named and value named/namespace nonmergeable pairs.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsDefaultThenNamedValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import def from "m";
import { named } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
