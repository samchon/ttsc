package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsAllowsExportStarBesideNamedImport
// verifies `includeExports: true` accepts `export * from "m"` next to a
// named import of "m", in both declaration orders.
//
// Locks the export-all exclusion in `duplicateImportsCanMerge`: `export
// *` cannot be folded into a named import
// (or vice versa) — only another `export *` or a bare side-effect import
// merges with it. Both orders exercise both operand sides of the
// symmetric guard.
//
//  1. Import named bindings then `export *` for "m"; `export *` then a
//     named import for "n".
//  2. Run the rule with `includeExports: true`.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Enabled export checking accepts export-all beside named imports in both orders. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations An export-all clause cannot be consolidated into a named import; zero findings follows mergeability rather than module equality. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Both operand orders contrast with export-all beside a side-effect import, which is mergeable and separately reported.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsAllowsExportStarBesideNamedImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export * from "m";
export * from "n";
import { other } from "n";
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
