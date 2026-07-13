package linthost

import "testing"

// TestNoDuplicateImportsIncludeExportsSkipsLocalExportWithoutModule
// verifies `includeExports: true` ignores `export { … }` statements that
// have no `from` clause.
//
// Locks the missing-module guard on the export arm: a local export
// re-exports nothing and names no module, so it must not join the
// module-keyed comparison. If the nil `ModuleSpecifier` were keyed under
// the empty string, two local exports would falsely collide with each
// other.
//
// 1. Import from "m", declare locals, and export them twice without `from`.
// 2. Run the rule with `includeExports: true`.
// 3. Assert zero findings.
func TestNoDuplicateImportsIncludeExportsSkipsLocalExportWithoutModule(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
const first = value;
const second = value;
export { first };
export { second };
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
