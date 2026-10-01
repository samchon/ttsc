package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsAllowsNamespaceReexportBesideNamedImport
// verifies `includeExports: true` accepts `export * as ns from "m"`
// next to a named import of "m".
//
// Locks the namespace categorization of aliased star re-exports in
// `duplicateImportsExportEntry`: `export * as ns` is a namespace
// specifier, so the namespace/named exclusion applies across declaration
// kinds. Miscategorizing it as export-all would also pass here, which is
// why the export-star-beside-namespace-reexport case exists as the
// discriminating twin.
//
// 1. Re-export `* as ns` from "m", then import named bindings from "m".
// 2. Run the rule with `includeExports: true`.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Enabled export checking accepts namespace reexport beside a named import. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Namespace/named exclusion crosses declaration kinds; the literal zero result follows the same syntax mergeability constraint. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases This case alone cannot distinguish an export-all misclassification; TestNoDuplicateImportsIncludeExportsAllowsExportStarBesideNamespaceReexport supplies that distinction.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsAllowsNamespaceReexportBesideNamedImport(t *testing.T) {
  got := runNoDuplicateImports(t, `export * as namespace from "m";
import { value } from "m";
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
