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
func TestNoDuplicateImportsIncludeExportsAllowsExportStarBesideNamespaceReexport(t *testing.T) {
  got := runNoDuplicateImports(t, `export * as namespace from "m";
export * from "m";
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
