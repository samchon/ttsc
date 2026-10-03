package linthost

import "testing"

// TestNoDuplicateImportsAllowSeparateTypeImportsAllowsValuePlusTypeImport
// verifies `allowSeparateTypeImports: true` accepts one value import
// plus one clause-level type import of the same module, in both orders.
//
// Locks the option's skip branch in `duplicateImportsShouldReport`: when
// the new and the earlier declaration differ in clause-level type-ness,
// the pair is exempt from the mergeability comparison. Both orders
// exercise the comparison from the value side and from the type side.
//
//  1. Import a default value binding then clause-level type bindings from
//     "m", and type bindings then a value binding from "n".
//  2. Run the rule with `allowSeparateTypeImports: true`.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. The enabled separation option accepts value and clause-level type imports in both orders. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations allowSeparateTypeImports explicitly exempts unlike declaration categories; the literal zero expectation follows that policy. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases m and n reverse type/value order; the still-reports-type/value-pairs siblings guard against muting an entire category.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsAllowSeparateTypeImportsAllowsValuePlusTypeImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import api from "m";
import type { IEntity } from "m";
import type { IOther } from "n";
import { other } from "n";
`, `{"allowSeparateTypeImports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
