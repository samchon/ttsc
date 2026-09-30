package linthost

import "testing"

// TestFixPreferTemplateFlattensTemplateExpressionSubchain verifies that
// a template literal WITH substitutions marks its sub-chain string-like:
// “ a + `x${y}` + "s" “ → “ `${a}${`x${y}`}s` “.
//
// The containment gate must treat `KindTemplateExpression` the same as
// a plain string literal — upstream ESLint's `isStringLiteral` covers
// template literals — because a template operand forces every `+` in
// its sub-chain to be string concatenation, making per-operand slots
// value-preserving. Only counting `KindStringLiteral` would demote the
// sub-chain to one `${a + `x${y}`}` slot.
//
//  1. Snapshot a chain whose only left-side string-like operand is a
//     substitution template.
//  2. Apply `prefer-template` fix.
//  3. Assert the sub-chain flattens into per-operand slots.
//
// @evidence contracts/testing.md#behavioral-verification Fixes a plus an existing template expression while retaining that expression as an evaluated nested slot.
// @evidence contracts/testing.md#independent-expectations The authored nested template output preserves original inner interpolation and evaluation as an operand, rather than reconstructing its body.
// @evidence contracts/testing.md#distinguishing-cases Existing expression template and trailing string distinguish flattening only the outer concatenation.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateFlattensTemplateExpressionSubchain(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst y: any = 2;\nconst s = a + `x${y}` + \"s\";\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst y: any = 2;\nconst s = `${a}${`x${y}`}s`;\nJSON.stringify(s);\n",
  )
}
