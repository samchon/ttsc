package linthost

import "testing"

// TestNoDuplicateImportsReportsRepeatedSideEffectImports verifies
// no-duplicate-imports reports a second bare side-effect import of the
// same module.
//
// Locks the SideEffectImport category from `duplicateImportsImportEntry`
// on the clause-less shape: two `import "m"` declarations trivially
// consolidate into one, and the official implementation treats the
// side-effect category as mergeable with every import category.
//
// 1. Write the same bare `import "m"` twice.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Two same-module side-effect imports report the second. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The module executes once and duplicate side-effect syntax is consolidatable; the literal line-2 message is independent of findings. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases No bindings exist, distinguishing module side effects from named or namespace clause handling.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsRepeatedSideEffectImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import "m";
import "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
