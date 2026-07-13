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
func TestNoDuplicateImportsAllowsTypeDefaultAndTypeNamedImports(t *testing.T) {
  got := runNoDuplicateImports(t, `import type DefaultType from "m";
import type { NamedType } from "m";
import type { OtherNamed } from "n";
import type OtherDefault from "n";
`, `{}`)
  assertNoDuplicateImportsFindings(t, got)
}
