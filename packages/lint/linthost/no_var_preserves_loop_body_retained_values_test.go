package linthost

import "testing"

// TestNoVarPreservesLoopBodyRetainedValues verifies no-var does not rewrite a
// body var that retains its value across iterations.
//
// A var is one function binding, so re-entering an uninitialized declaration
// keeps the prior value; a fresh let would change the result from [0,0] to
// [0,1].
//
//  1. Attempt fixes for for, while and do bodies plus an inner for header that
//     declare an uninitialized var and assign it conditionally.
//  2. Fix an initialized body declaration and a for-of header var assigned a value.
//  3. Assert the uninitialized declarations stay as var and the initialized ones
//     become let.
//
// @evidence contracts/testing.md#behavioral-verification Actual no-var edits retain uninitialized repeated body declarations and still rewrite an initialized body declaration and assigned for-of header.
// @evidence contracts/testing.md#independent-expectations Var is one function binding; fresh let bindings would change the authored two-iteration result from [0,0] to [0,1]. Initializers and for-of assignments reset values independently.
// @evidence contracts/testing.md#distinguishing-cases For, while and do bodies plus a for header nested in a repeated outer body decline without initializers; an initialized body and value-assigned for-of header remain positive controls.
// @evidence contracts/testing.md#execution-ownership Disk-backed parser, rule Engine and edit applier run in this Go unit without a product artifact or subprocess.
func TestNoVarPreservesLoopBodyRetainedValues(t *testing.T) {
  for _, source := range []string{
    `export {}; function f(){ const out=[]; for(let i=0;i<2;i++){var x; x ??= i; out.push(x);} return out;}`,
    `export {}; function f(){ let i=0; while(i++<2){var x; x ??= i;} }`,
    `export {}; function f(){ let i=0; do {var x; x ??= i;} while(i++<2); }`,
    `export {}; function f(){ for(let i=0;i<2;i++){for(var x; (x ??= i)<2; x++){consume(x);}} }`,
  } {
    assertNoFixSnapshot(t, "no-var", source)
  }
  assertFixSnapshot(t, "no-var", `export {}; function f(){ for(let i=0;i<2;i++){var x=i; consume(x);} }`, `export {}; function f(){ for(let i=0;i<2;i++){let x=i; consume(x);} }`)
  assertFixSnapshot(t, "no-var", `export {}; function f(){ for(var x of [1,2]){consume(x);} }`, `export {}; function f(){ for(let x of [1,2]){consume(x);} }`)
}
