package linthost

import "testing"

// TestPreferTemplatePreservesDefaultCoercionHint verifies that prefer-template
// fixes keep concatenation's default coercion hint inside each interpolation.
//
// Template interpolation requests the string hint, so the fix writes
// `${"" + (x)}` to keep the hint that `+` requested originally.
//
// 1. Fix concatenations of a custom toPrimitive object, Date, Symbol() and two calls.
// 2. Assert the already-rewritten output reports nothing, for a plain and a grouped chain.
// 3. Assert the grouped chain reports exactly its full span.
//
// @evidence contracts/testing.md#behavioral-verification Real fixes keep explicit default-hint coercion for custom primitives, Date, Symbol and ordered calls; a second rule pass leaves that coercion intact.
// @evidence contracts/testing.md#independent-expectations ECMAScript plus requests the default ToPrimitive hint while direct interpolation requests string. Empty-prefix plus preserves the original hint and Symbol throw before interpolation.
// @evidence contracts/testing.md#distinguishing-cases Custom primitive hints, built-in Date, Symbol errors and sequential effectful operands contrast with an already preserved interpolation.
// @evidence contracts/testing.md#execution-ownership The Go unit applies real Engine edits to disk-backed authored sources through assertFixSnapshot and compares independent complete output; it does not evaluate the rewritten code at runtime.
func TestPreferTemplatePreservesDefaultCoercionHint(t *testing.T) {
  assertFixSnapshot(t, "prefer-template",
    `const x={ [Symbol.toPrimitive](hint){return hint==='string'?'s':'d'} }; const out='x'+x;`,
    "const x={ [Symbol.toPrimitive](hint){return hint==='string'?'s':'d'} }; const out=`x${\"\" + (x)}`;")
  assertFixSnapshot(t, "prefer-template", `const out='x'+new Date(0);`, "const out=`x${\"\" + (new Date(0))}`;")
  assertFixSnapshot(t, "prefer-template", `const out='x'+Symbol();`, "const out=`x${\"\" + (Symbol())}`;")
  assertFixSnapshot(t, "prefer-template", `const out='x'+first()+second();`, "const out=`x${\"\" + (first())}${\"\" + (second())}`;")
  assertRuleSkipsSource(t, "prefer-template", "const out=`x${\"\" + (x)}`;")
  assertFixSnapshot(t, "prefer-template", `const out=left+('x'+right())+'end';`, "const out=`${\"\" + (left+('x'+right()))}end`;")
  assertRuleSkipsSource(t, "prefer-template", "const out=`${\"\" + (left+('x'+right()))}end`;")
  assertRuleFindingRanges(t, "prefer-template", `const out=left+('x'+right())+'end';`, "left+('x'+right())+'end'")
}
