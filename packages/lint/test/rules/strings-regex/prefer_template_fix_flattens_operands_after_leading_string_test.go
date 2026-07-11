package linthost

import "testing"

// TestFixPreferTemplateFlattensOperandsAfterLeadingString verifies the
// negative twin of the numeric-subchain gate: `"count: " + a + b` →
// “ `count: ${a}${b}` “.
//
// Here the string literal is the FIRST operand, so every later `+` in
// the left-associative chain is string concatenation and flattening
// each operand into its own slot preserves the value. The gate in
// `flattenConcatOperands` must keep descending into sub-chains that
// contain a string-like operand — over-correcting to `${a + b}` here
// would itself change the value ("count: 12" is correct, not
// "count: 3").
//
// 1. Snapshot a chain whose leftmost operand is a string literal.
// 2. Apply `prefer-template` fix.
// 3. Assert each trailing operand keeps its own `${…}` slot.
func TestFixPreferTemplateFlattensOperandsAfterLeadingString(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst b: any = 2;\nconst s = \"count: \" + a + b;\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst b: any = 2;\nconst s = `count: ${a}${b}`;\nJSON.stringify(s);\n",
  )
}
