package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsReexportAfterImport
// verifies `includeExports: true` reports a named re-export of a module
// that already has a mergeable import above.
//
// Locks the export-versus-imports pairing (the official `exportAs`
// message): the re-export could be folded into the existing import plus
// a local `export`, so the pair is a duplicate across declaration kinds
// and carries the duplicated-as-import message rather than the plain
// export message.
//
// 1. Import named bindings from "m", then `export { … } from "m"`.
// 2. Run the rule with `includeExports: true`.
// 3. Assert exactly one duplicated-as-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. A reexport after a same-module named import reports export duplicated as import at line 2. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The earlier declaration is an import, establishing the independently authored directional message. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Pins the reverse of TestNoDuplicateImportsIncludeExportsReportsImportAfterReexport.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsReportsReexportAfterImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export { value } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` export is duplicated as import."},
  })
}
