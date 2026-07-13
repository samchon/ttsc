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
func TestNoDuplicateImportsIncludeExportsAllowsNamespaceReexportBesideNamedImport(t *testing.T) {
  got := runNoDuplicateImports(t, `export * as namespace from "m";
import { value } from "m";
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
