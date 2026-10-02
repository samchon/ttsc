package linthost

import "testing"

// TestNoDuplicateImportsTrimsModuleSpecifierWhitespace verifies module
// specifiers are compared after trimming surrounding whitespace.
//
// Locks `duplicateImportsModule` parity with the official `getModule`,
// which compares `source.value.trim()`. Without trimming, `" m "` and
// `"m"` would silently count as different modules and the pair would
// escape the duplicate comparison.
//
// 1. Import from `"m"`, then from `" m "`, then from the different module `" n "`.
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding, on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Whitespace around the second module string is normalized for duplicate identity. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The supported duplicate rule compares trimmed nonempty module keys, so literal m and spaced m share the authored line-2 expectation. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases The spaced and unspaced `m` collide while the spaced `" n "` is a different module after trimming and stays silent, so trimming is not a blanket match.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsTrimsModuleSpecifierWhitespace(t *testing.T) {
  got := runNoDuplicateImports(t, `import { first } from "m";
import { second } from " m ";
import { third } from " n ";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
