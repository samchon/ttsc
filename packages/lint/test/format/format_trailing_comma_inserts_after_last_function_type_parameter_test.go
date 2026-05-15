package main

import "testing"

// TestFormatTrailingCommaInsertsAfterLastFunctionTypeParameter verifies
// the rule reaches multi-line parameter lists on TypeScript function
// type literals (`(a, b) => T`).
//
// Function type literals are TS-only type expressions whose parameter
// list shares prettier's `printFunctionParameters` path with every
// other signature shape. The `KindFunctionType` dispatch arm
// short-circuits on the es5 guard and routes through
// `considerFunctionParameterComma`. Pinning the function-type path
// closes the value-vs-type peer asymmetry that the rule's older slate
// had — value functions were covered, type-level function literals
// were not.
//
//  1. Parse a source file with one type alias whose body is a
//     multi-line function type literal.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last parameter.
func TestFormatTrailingCommaInsertsAfterLastFunctionTypeParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "type BinaryOp = (\n  left: number,\n  right: number\n) => number;\nlet f: BinaryOp;\nf;\n",
    "type BinaryOp = (\n  left: number,\n  right: number,\n) => number;\nlet f: BinaryOp;\nf;\n",
  )
}
