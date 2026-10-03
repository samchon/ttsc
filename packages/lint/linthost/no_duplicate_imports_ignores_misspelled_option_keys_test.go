package linthost

import "testing"

// TestNoDuplicateImportsIgnoresMisspelledOptionKeys verifies a
// misspelled option key leaves the rule on its official defaults
// instead of disabling it or panicking.
//
// Locks the options decode path: `DecodeOptions` ignores unknown JSON
// keys, so `allowSeparateTypeImport` (missing the trailing `s`) must not
// activate the type/value separation. This preserves the default duplicate
// finding for untyped JSON options; it does not reject the misspelled key.
// Compile-time typo rejection belongs to the TypeScript typing test.
//
// 1. Import a value binding and a clause-level type binding from one module.
// 2. Run the rule with a misspelled `allowSeparateTypeImport` key.
// 3. Assert the default behavior still reports the second declaration.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. A misspelled allowSeparateTypeImport key leaves the value/type duplicate at line 2. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Unknown JSON keys do not enable the official plural option; authored defaults require the exact duplicated-import message. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Contrasts a near-miss key with the correctly spelled acceptance case without treating configuration text itself as the observable.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIgnoresMisspelledOptionKeys(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
import type { Entity } from "m";
`, `{"allowSeparateTypeImport":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
