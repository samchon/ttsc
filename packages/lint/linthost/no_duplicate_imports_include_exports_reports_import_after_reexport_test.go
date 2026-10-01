package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsReportsImportAfterReexport
// verifies `includeExports: true` reports an import of a module that was
// already re-exported above.
//
// Locks the import-versus-exports pairing (the official `importAs`
// message): the import handler additionally compares against recorded
// re-exports when the option is on, and the finding carries the
// duplicated-as-export message. With the option off, the earlier
// re-export would never have been recorded and this import would pass.
//
// 1. Re-export named bindings from "m", then import from "m".
// 2. Run the rule with `includeExports: true`.
// 3. Assert exactly one duplicated-as-export finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. A named import after a same-module reexport reports import duplicated as export at line 2. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The earlier declaration is an export, so the literal directional message must differ from export duplicated as import. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Pins one directional pairing; the reexport-after-import sibling covers the reverse.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsReportsImportAfterReexport(t *testing.T) {
  got := runNoDuplicateImports(t, `export { thing } from "m";
import { value } from "m";
`, `{"includeExports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated as export."},
  })
}
