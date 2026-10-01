package linthost

import "testing"

// Boolean coercion must not invoke a lexical or replaced global Boolean.
// @evidence contracts/testing.md#behavioral-verification Real ternary edits use intrinsic coercion for function/parameter shadowing and preserve assignment/logical precedence and false/true inversion.
// @evidence contracts/testing.md#independent-expectations Double negation performs ECMAScript ToBoolean once on the evaluated condition and resolves no named binding; complete authored outputs preserve its grouping.
// @evidence contracts/testing.md#distinguishing-cases Function and parameter shadowing, low-precedence assignment/logical expressions and inverted branches distinguish binding and precedence failures.
// @evidence contracts/testing.md#execution-ownership Parser, Engine and disk edit applier execute within this Go unit; no installed artifact or product subprocess is used.
func TestNoUnneededTernaryUsesIntrinsicBooleanCoercion(t *testing.T) {
  assertFixSnapshot(t, "no-unneeded-ternary", `function Boolean(){return false}; const out=1 ? true : false;`, `function Boolean(){return false}; const out=!!1;`)
  assertFixSnapshot(t, "no-unneeded-ternary", `function f(Boolean,x){return x ? true : false}`, `function f(Boolean,x){return !!x}`)
  assertFixSnapshot(t, "no-unneeded-ternary", `const out=(x=y) ? true : false;`, `const out=!!((x=y));`)
  assertFixSnapshot(t, "no-unneeded-ternary", `const out=a || b ? true : false;`, `const out=!!(a || b);`)
  assertFixSnapshot(t, "no-unneeded-ternary", `const out=a || b ? false : true;`, `const out=!(a || b);`)
}
