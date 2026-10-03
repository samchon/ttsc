package linthost

import "testing"

// TestNoDuplicateImportsIgnoresReexportsByDefault verifies the official
// default `includeExports: false` leaves `export … from` declarations
// out of the analysis entirely.
//
// Locks the option gate in the rule's statement walk: without
// `includeExports`, re-exports are neither reported nor recorded, so a
// re-export of an imported module and two same-module re-exports stay
// silent. This is the negative twin of every include-exports case.
//
// 1. Import from "m", then re-export from "m" twice.
// 2. Run the rule with default options.
// 3. Assert zero findings, including a re-export before a lone import.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Default no-duplicate-imports ignores both reexports after an import. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations includeExports defaults false, so reexports neither report nor seed later duplicate comparisons. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases An import and two same-module reexports would report if the gate were absent; enabled-export cases own the positive side.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsIgnoresReexportsByDefault(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
export { first } from "m";
export { second } from "m";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
  got = runNoDuplicateImports(t, `export { first } from "n";
import { value } from "n";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
