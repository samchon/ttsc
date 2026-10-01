package linthost

import "testing"

// TestNoDuplicateImportsAllowsTypeNamespaceAndTypeNamedImports verifies
// a type-only namespace import and a type-only named import of the same
// module are accepted.
//
// Locks the interaction of the two exclusions in
// `duplicateImportsCanMerge`: the type-only default/named guard does not
// match this pair (neither side is a default), so acceptance must come
// from the general namespace/named exclusion — which applies to
// type-only declarations exactly as it does to value declarations.
//
// 1. Import `type * as ns` and then `type { Named }` from one module.
// 2. Run the rule with default options.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Type-only namespace and named imports remain accepted. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations Namespace and named clauses cannot share one import declaration, including when both are type-only. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases This type/type pair rules out applying namespace exclusion only to values; named/namespace value symmetry has a separate case.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsAllowsTypeNamespaceAndTypeNamedImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import type * as namespace from "m";
import type { NamedType } from "m";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
