package linthost

import "testing"

// TestNoDuplicateImportsAllowsTypeDefaultAndTypeNamedImports verifies a
// type-only default import and a type-only named import of the same
// module are accepted, in both declaration orders.
//
// Locks parity with the ESLint 9.30.1 correction: `import type Def, {
// Named } from "m"` is not legal TypeScript, so the pair cannot be
// consolidated and is not a duplicate — under the default options, with
// no `allowSeparateTypeImports` involved. Both orders exercise both
// operand sides of the guard in `duplicateImportsCanMerge`.
//
//  1. Import a type-only default then type-only named bindings from "m",
//     and the reverse order from "n".
//  2. Run the rule with default options.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification runNoDuplicateImports exercises the actual no-duplicate-imports Engine operation. Type-only default and type-only named declarations remain accepted in both orders. The shared assertion also rejects unexpected rules and any offered autofix.
// @evidence contracts/testing.md#independent-expectations TypeScript forbids a combined type-only default/named declaration; ESLint 9.30.1 parity therefore requires zero findings. The helper only normalizes returned line/message pairs and compares them with literal expectations.
// @evidence contracts/testing.md#distinguishing-cases Both orders isolate mergeability from merely repeating a module specifier; two type defaults remain covered by the reporting sibling.
// @evidence contracts/testing.md#execution-ownership runNoDuplicateImports calls parseTSFile and NewEngineWithResolver.Run for this entry's authored source/options, then assertNoDuplicateImportsFindings performs the displayed literal result comparison. This Test owns that source and option combination in the Go process, without dynamic registration or a native host.
func TestNoDuplicateImportsAllowsTypeDefaultAndTypeNamedImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import type DefaultType from "m";
import type { NamedType } from "m";
import type { OtherNamed } from "n";
import type OtherDefault from "n";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
