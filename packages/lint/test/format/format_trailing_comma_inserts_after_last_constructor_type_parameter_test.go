package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastConstructorTypeParameter verifies
// the rule reaches multi-line parameter lists on TypeScript constructor
// type literals (`new (a, b) => T`).
//
// A constructor type literal has a parameter list in type space. Its comma policy matches formal parameters while its returned type remains untouched.
//
//  1. Parse a source file with one type alias whose body is a
//     multi-line constructor type literal.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
//
// @evidence contracts/testing.md#behavioral-verification The constructor type must gain a comma after y:number while retaining its new keyword, x parameter and returned object type.
// @evidence contracts/testing.md#independent-expectations TypeScript constructor-type formal parameters permit terminal commas under the Prettier all policy. The literal expected type preserves its complete signature independently of runtime constructor dispatch.
// @evidence contracts/testing.md#distinguishing-cases This new-flavored type literal differs from class constructors and interface construct signatures. Their separate hosts verify each syntax owner rather than assuming a shared shape is sufficient.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastConstructorTypeParameter owns its authored literal source and complete expected edit output in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastConstructorTypeParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "type PointCtor = new (\n  x: number,\n  y: number\n) => { x: number; y: number };\nlet c: PointCtor;\nc;\n",
    "type PointCtor = new (\n  x: number,\n  y: number,\n) => { x: number; y: number };\nlet c: PointCtor;\nc;\n",
  )
}
