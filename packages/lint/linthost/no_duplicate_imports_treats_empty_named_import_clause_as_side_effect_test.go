package linthost

import "testing"

// TestNoDuplicateImportsTreatsEmptyNamedImportClauseAsSideEffect
// verifies `import {} from "m"` is categorized as a side-effect import,
// not as named bindings.
//
// Locks the empty-`NamedImports` branch in
// `duplicateImportsImportEntry`. In ESTree an empty block contributes no
// specifiers, so the official rule categorizes the declaration as
// SideEffectImport. The discriminating pairing is a preceding namespace
// import: side-effect merges with namespace (finding), while a
// miscategorized named clause would hit the namespace/named exclusion
// and stay silent.
//
// 1. Import `* as ns` from "m", then `import {} from "m"`.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. An empty named import after a namespace import reports as a duplicate. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations With no default or named bindings, import {} retains only the module operation and can be folded into the earlier namespace import. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Empty braces differ from a named binding and from default-plus-empty syntax, preventing category collapse.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsTreatsEmptyNamedImportClauseAsSideEffect(t *testing.T) {
  got := runNoDuplicateImports(t, `import * as namespace from "m";
import {} from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
