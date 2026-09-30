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
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Local export clauses do not join a same-module import duplicate comparison. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Exports without a module specifier are not module-loading declarations; authored zero findings follows that boundary. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Two local exports alongside an import detect treating any export clause as a reexport.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIncludeExportsSkipsLocalExportWithoutModule(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
const first = value;
const second = value;
export { first };
export { second };
`, `{"includeExports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
