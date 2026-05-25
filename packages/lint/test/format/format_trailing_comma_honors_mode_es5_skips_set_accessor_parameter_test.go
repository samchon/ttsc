package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsSetAccessorParameter verifies
// the rule emits no findings on a multi-line setter parameter under
// `mode: "es5"`.
//
// Set accessors take exactly one parameter; ES5 grammar disallows a
// trailing comma after it. The `KindSetAccessor` arm short-circuits on
// the es5 guard before `considerFunctionParameterComma`. Pinning the
// skip keeps the asymmetric peer of `KindGetAccessor` regression-safe
// (the getter takes zero parameters and has no positive insert case to
// pin separately).
//
//  1. Parse a source file with one class whose setter parameter spans
//     multiple lines.
//  2. Run the engine with `mode: "es5"` configured.
//  3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsSetAccessorParameter(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "formatTrailingComma",
    "class Box {\n  private _value = 0;\n  set value(\n    next: number\n  ) {\n    this._value = next;\n  }\n}\nBox;\n",
    `{"mode":"es5"}`,
  )
}
