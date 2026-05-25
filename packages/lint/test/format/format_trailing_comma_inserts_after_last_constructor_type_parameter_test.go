package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastConstructorTypeParameter verifies
// the rule reaches multi-line parameter lists on TypeScript constructor
// type literals (`new (a, b) => T`).
//
// Constructor type literals are the `new`-flavored peer of function
// type literals; the `KindConstructorType` dispatch arm short-circuits
// on the es5 guard and routes through `considerFunctionParameterComma`.
// Pinning the constructor-type path keeps the fifth and final
// signature-family arm regression-safe.
//
//  1. Parse a source file with one type alias whose body is a
//     multi-line constructor type literal.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
func TestFormatTrailingCommaInsertsAfterLastConstructorTypeParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "type PointCtor = new (\n  x: number,\n  y: number\n) => { x: number; y: number };\nlet c: PointCtor;\nc;\n",
    "type PointCtor = new (\n  x: number,\n  y: number,\n) => { x: number; y: number };\nlet c: PointCtor;\nc;\n",
  )
}
