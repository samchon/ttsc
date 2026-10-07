package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsAllowsExportStarBesideNamespaceReexport
// verifies `includeExports: true` accepts `export * as ns from "m"`
// next to a bare `export * from "m"`.
//
// Discriminates the namespace-export category from export-all in
// `duplicateImportsExportEntry`: the two star forms cannot merge (the
// export-all exclusion blocks export-all against namespace bindings),
// but if the aliased form were miscategorized as export-all the pair
// would look like two mergeable `export *` declarations and produce a
// false finding.
//
// 1. Write `export * as ns from "m"` and then `export * from "m"`.
// 2. Run the rule with `includeExports: true`.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Enabled export checking accepts namespace reexport beside export-all. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations export * as namespace and export * are different binding forms that cannot be merged; treating both as export-all would falsely report. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases This pair discriminates namespace classification where the named-import/namespace case alone cannot.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsAllowsExportStarBesideNamespaceReexport(t *testing.T) {
  got := runNoDuplicateImports(t, `export * as namespace from "m";
export * from "m";
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
