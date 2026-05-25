package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastSetAccessorParameter verifies the rule
// reaches the (singular) parameter on a multi-line setter declaration.
//
// Set accessors are the asymmetric peer of get accessors: by ECMAScript
// grammar `set foo(value)` accepts exactly one parameter while `get foo()`
// accepts zero, so multi-line setters always hit the singular-parameter
// path. Pinning the set-accessor arm keeps the `KindSetAccessor` dispatch
// regression-safe — without this test the only coverage would be the
// `lastParameterIsRest`/`len == 0` short-circuit paths in
// `considerFunctionParameterComma`.
//
//  1. Parse a source file with one class whose setter parameter spans multiple
//     lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the parameter.
func TestFormatTrailingCommaInsertsAfterLastSetAccessorParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "class Box {\n  private _value = 0;\n  set value(\n    next: number\n  ) {\n    this._value = next;\n  }\n}\nBox;\n",
    "class Box {\n  private _value = 0;\n  set value(\n    next: number,\n  ) {\n    this._value = next;\n  }\n}\nBox;\n",
  )
}
