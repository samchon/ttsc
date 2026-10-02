package linthost

import "testing"

// TestFixPreferTemplateFlattensOperandsAfterLeadingString verifies the
// negative twin of the numeric-subchain gate: `"count: " + a + b` →
// “ `count: ${"" + (a)}${"" + (b)}` “.
//
// Here the string literal is the FIRST operand, so every later `+` in
// the left-associative chain is string concatenation and flattening
// each operand into its own slot preserves the value. The gate in
// `flattenConcatOperands` must keep descending into sub-chains that
// contain a string-like operand — over-correcting to `${"" + (a + b)}` here
// would itself change the value ("count: 12" is correct, not
// "count: 3").
//
// 1. Snapshot a chain whose leftmost operand is a string literal.
// 2. Apply `prefer-template` fix.
// 3. Assert each trailing operand keeps its own `${"" + (…)}` slot.
//
// @evidence contracts/testing.md#behavioral-verification Fixes string-leading +a+b as separate interpolation slots.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
//
// @evidence contracts/testing.md#independent-expectations Once the leading string is evaluated, successive + operations concatenate individually; literal ${"" + (a)}${"" + (b)} preserves that coercion order.
// @evidence contracts/testing.md#distinguishing-cases Contrasts numeric leading subchain, which must stay inside one arithmetic slot.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateFlattensOperandsAfterLeadingString(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst b: any = 2;\nconst s = \"count: \" + a + b;\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst b: any = 2;\nconst s = `count: ${\"\" + (a)}${\"\" + (b)}`;\nJSON.stringify(s);\n",
  )
}
