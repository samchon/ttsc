package linthost

import "testing"

// TestNoDuplicateImportsAllowsNamedAndNamespaceValueImports verifies
// no-duplicate-imports accepts a named and a namespace import of the
// same module, in both declaration orders.
//
// Locks the namespace/named exclusion in `duplicateImportsCanMerge`:
// TypeScript has no declaration form carrying both `* as ns` and named
// bindings, so the pair is not consolidatable and must not be reported.
// Both orders exercise both operand sides of the symmetric guard; the
// old specifier-string implementation reported both, so this is the
// regression pin for issue #401's second consequence.
//
// 1. Import named-then-namespace from "m" and namespace-then-named from "n".
// 2. Run the rule with default options.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Named and namespace value imports from one module are accepted in both declaration orders. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations TypeScript has no legal import declaration combining named bindings and a namespace clause, so these cannot be consolidated. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Both m and n reverse order; default-plus-named and two namespaces have separate reporting cases.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsAllowsNamedAndNamespaceValueImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import { named } from "m";
import * as namespace from "m";
import * as other from "n";
import { thing } from "n";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
