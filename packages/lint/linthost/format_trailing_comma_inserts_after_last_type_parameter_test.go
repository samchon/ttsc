package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastTypeParameter verifies the rule
// reaches multi-line TypeScript type-parameter declaration lists.
//
// Declaration type parameters and call-site type arguments have different comma policies. Only the declaration list in this positive must gain terminal punctuation.
//
//  1. Parse a source file with one multi-line generic function declaration.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last type parameter.
//  4. Assert a broken generic-call type-argument list produces no finding.
//
// @evidence contracts/testing.md#behavioral-verification The generic function must gain one comma after K extends keyof T while retaining both constraints, its value parameters and indexed return/body; a generic call must keep its type-argument list unchanged.
// @evidence contracts/testing.md#independent-expectations Official Prettier options permit terminal commas in TypeScript declaration type parameters. The literal expected generic function independently preserves its constraints and type relationship.
// @evidence contracts/testing.md#distinguishing-cases Two constrained declaration type parameters supply a positive, unlike type arguments at call sites. An added broken generic-call type-argument negative distinguishes declaration from application.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastTypeParameter owns its authored declaration source, complete expected edit output and call-site type-argument negative in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastTypeParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "function pick<\n  T extends object,\n  K extends keyof T\n>(obj: T, key: K): T[K] {\n  return obj[key];\n}\npick;\n",
    "function pick<\n  T extends object,\n  K extends keyof T,\n>(obj: T, key: K): T[K] {\n  return obj[key];\n}\npick;\n",
  )
  assertRuleSkipsSource(t, "format/trailing-comma", "pick<\n  FirstType,\n  SecondType\n>(value);\n")
}
