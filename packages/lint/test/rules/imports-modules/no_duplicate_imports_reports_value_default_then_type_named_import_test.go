package linthost

import "testing"

// TestNoDuplicateImportsReportsValueDefaultThenTypeNamedImport verifies
// the default configuration reports a clause-level type named import
// after a value default import of the same module.
//
// Pins the both-type precondition of the ESLint 9.30.1 guard in
// `duplicateImportsCanMerge`: the default/named exemption applies only
// when BOTH declarations are type-only. This pair has the exempted
// category shape (default beside named) but only one type-only side, so
// it merges into `import def, { type Named } from "m"` and must report.
// A guard loosened to exempt the pair when either side is type-only
// would go silent here.
//
//  1. Import a value default binding, then clause-level named type
//     bindings, from one module.
//  2. Run the rule with default options.
//  3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Value default followed by type named import reports the second under defaults. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The default option includes unlike type categories and this pair is consolidatable under a value declaration. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Contrasts type-only default/named acceptance and enabled mixed-category separation.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsReportsValueDefaultThenTypeNamedImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import def from "m";
import type { Named } from "m";
`, `{}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
