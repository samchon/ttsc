package linthost

import "testing"

// TestNoDuplicateImportsClassifiesInlineTypeSpecifierAsValue verifies
// `import { type Foo } from "m"` counts as a value declaration under
// `allowSeparateTypeImports: true`, not as a clause-level type import.
//
// Locks the clause-level reading of type-ness in
// `duplicateImportsImportEntry`: only `ImportClause.IsTypeOnly()`
// (`import type …`) makes a declaration type-only; an inline `type`
// modifier on a specifier leaves the import clause value-bearing. If the
// inline modifier leaked into the declaration's type-ness, the option
// would wrongly exempt this pair and the finding would disappear.
//
// 1. Import named value bindings, then an inline-type specifier, from "m".
// 2. Run the rule with `allowSeparateTypeImports: true`.
// 3. Assert exactly one duplicate-import finding on the second line.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. An inline type specifier joins a preceding named value import despite allowSeparateTypeImports. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Only clause-level import type makes the whole declaration type-only; the exact line-2 duplicate follows that syntax distinction. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases The inline form differs from the clause-level type acceptance sibling, preventing an overbroad type separation.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsClassifiesInlineTypeSpecifierAsValue(t *testing.T) {
  got := runNoDuplicateImports(t, `import { value } from "m";
import { type Foo } from "m";
`, `{"allowSeparateTypeImports":true}`)
  assertDuplicateImportsFindings(t, got, []duplicateImportsFinding{
    {Line: 2, Message: "`m` import is duplicated."},
  })
}
