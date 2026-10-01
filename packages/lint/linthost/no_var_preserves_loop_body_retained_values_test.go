package linthost

import "testing"

// Re-entering an uninitialized var declaration retains its prior value.
// @evidence contracts/testing.md#behavioral-verification Actual no-var edits retain uninitialized repeated body declarations and still rewrite an initialized body declaration and assigned for-of header.
// @evidence contracts/testing.md#independent-expectations Var is one function binding; fresh let bindings would change the authored two-iteration result from [0,0] to [0,1]. Initializers and for-of assignments reset values independently.
// @evidence contracts/testing.md#distinguishing-cases For, while and do bodies decline without initializers; an initialized body and value-assigned header remain positive controls.
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
