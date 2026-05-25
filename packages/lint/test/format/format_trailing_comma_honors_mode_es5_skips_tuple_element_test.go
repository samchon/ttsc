package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsTupleElement verifies the rule
// emits no findings on a multi-line tuple type under `mode: "es5"`.
//
// Tuple types are TypeScript-only and have no ES5 grammar surface at all;
// the rule treats them as a runtime-skipped construct under `mode: "es5"`
// (the docstring on the `KindTupleType` arm calls this out explicitly).
// Pinning the skip keeps the type-level branch regression-safe alongside
// the runtime peer arms.
//
// 1. Parse a source file with one multi-line tuple type alias.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsTupleElement(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "formatTrailingComma",
    "type Pair = [\n  number,\n  string\n];\nconst v: Pair = [1, \"a\"];\nv;\n",
    `{"mode":"es5"}`,
  )
}
