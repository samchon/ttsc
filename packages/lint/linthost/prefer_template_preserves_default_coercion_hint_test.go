package linthost

import "testing"

// Template interpolation must retain concatenation's default coercion hint.
// @evidence contracts/testing.md#behavioral-verification Real fixes keep explicit default-hint coercion for custom primitives, Date, Symbol and ordered calls; a second rule pass leaves that coercion intact.
// @evidence contracts/testing.md#independent-expectations ECMAScript plus requests the default ToPrimitive hint while direct interpolation requests string. Empty-prefix plus preserves the original hint and Symbol throw before interpolation.
// @evidence contracts/testing.md#distinguishing-cases Custom primitive hints, built-in Date, Symbol errors and sequential effectful operands contrast with an already preserved interpolation.
// @evidence contracts/testing.md#execution-ownership The Go unit applies real Engine edits to disk-backed authored sources and checks independent complete output; runtime oracle comparisons are performed separately, not claimed as execution by this entry.
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
