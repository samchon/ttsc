package linthost

import "testing"

// TestNoDuplicateImportsSkipsEmptyModuleSpecifiers verifies imports with
// an empty (or whitespace-only) module string never participate in the
// duplicate comparison.
//
// Locks the empty-module guard: the official `handleImportsExports`
// skips declarations whose trimmed module name is falsy, so even two
// identical empty-specifier imports are not duplicates of each other.
// Removing the guard would key both under "" and report the second.
//
//  1. Write two `import { … } from ""` declarations and one whitespace-only
//     specifier.
//  2. Run the rule with default options.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Empty and whitespace-only module specifiers produce no duplicate findings. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The supported normalization ignores empty module keys; zero expectations are authored rather than inferred from scanner output. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Two empty strings and a whitespace-only specifier distinguish empty-key rejection from ordinary nonempty duplicate tracking.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsSkipsEmptyModuleSpecifiers(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "";
import { second } from "";
import { third } from "  ";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
