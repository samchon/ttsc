package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsAllowsExportStarBesideNamedImport
// verifies `includeExports: true` accepts `export * from "m"` next to a
// named import of "m", in both declaration orders.
//
// Locks the export-all exclusion in `duplicateImportsCanMerge`: `export
// *` re-exports every binding and cannot be folded into a named import
// (or vice versa) — only another `export *` or a bare side-effect import
// merges with it. Both orders exercise both operand sides of the
// symmetric guard.
//
//  1. Import named bindings then `export *` for "m"; `export *` then a
//     named import for "n".
//  2. Run the rule with `includeExports: true`.
//  3. Assert zero findings.
func TestNoDuplicateImportsIncludeExportsAllowsExportStarBesideNamedImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export * from "m";
export * from "n";
import { other } from "n";
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
