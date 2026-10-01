package linthost

import "testing"

// TestNoDuplicateImportsReportsSideEffectImportAfterNamedImport verifies
// no-duplicate-imports reports a bare side-effect import of a module
// that already has a named import above.
//
// Locks the cross-category mergeability of the side-effect shape: the
// module already loads through the named declaration, so the bare
// `import "m"` folds into it. The official mergeability table exempts
// the side-effect category from every exclusion, and this pins that the
// port did not accidentally isolate it.
//
// 1. Import named bindings from "m", then a bare `import "m"`.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. A side-effect import after a named import of the same module reports the second. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The named import already performs the module operation, so the later side-effect declaration is redundant. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases This asymmetrical declaration pair complements repeated side effects and export-all/side-effect order coverage.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsSideEffectImportAfterNamedImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { named } from "m";
import "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
