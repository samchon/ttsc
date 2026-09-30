package linthost

import "testing"

// TestNoDuplicateImportsAllowsInlineTypeSpecifierBesideTypeImport
// verifies `allowSeparateTypeImports: true` accepts a clause-level type
// import next to an inline-type-specifier import of the same module.
//
// Companion of the inline-classification case: because `import { type B
// }` is a value declaration, the option's type/value separation exempts
// it from comparison with the clause-level `import type { A }` above.
// Together the two cases pin the inline form to exactly the value side —
// compared against value imports, separated from type imports.
//
//  1. Import clause-level type bindings, then an inline-type specifier,
//     from one module.
//  2. Run the rule with `allowSeparateTypeImports: true`.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Clause-level import type and inline type specifiers remain separate when allowSeparateTypeImports is true. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations The clause modifier governs declaration category, not the individual specifier modifier; zero findings follows the explicit separation option. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases The type/inline pair is the negative twin of TestNoDuplicateImportsClassifiesInlineTypeSpecifierAsValue.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsAllowsInlineTypeSpecifierBesideTypeImport(t *testing.T) {
  got := runNoDuplicateImports(t, `import type { Alpha } from "m";
import { type Beta } from "m";
`, `{"allowSeparateTypeImports":true}`)
  assertNoDuplicateImportsFindings(t, got)
}
