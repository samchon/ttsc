package linthost

import "testing"

// TestNoDuplicateImportsReportsValueThenTypeNamedImportByDefault
// verifies the default configuration reports a clause-level `import
// type` declaration whose module already has a value import above.
//
// Locks the official default `allowSeparateTypeImports: false`: without
// the option, clause-level type declarations join the ordinary duplicate
// comparison, and named value bindings merge with named type bindings
// into `import { a, type B } from "m"`. This is the negative twin of the
// option-enabled acceptance case.
//
// 1. Import named value bindings and then clause-level type bindings from "m".
// 2. Run the rule with default options.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Value named followed by clause-level type named import reports the second under defaults. The shared runner also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Default allowSeparateTypeImports is false; literal line-2 duplicate requires comparison across categories. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases The correctly enabled separation sibling provides the negative side of this option gate.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsValueThenTypeNamedImportByDefault(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
import type { Entity } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
