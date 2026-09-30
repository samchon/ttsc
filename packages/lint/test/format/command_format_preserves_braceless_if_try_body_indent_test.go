package linthost

import "testing"

// TestCommandFormatPreservesBracelessIfTryBodyIndent guards a `try`/`catch`
// nested under a braceless `if` body. Like the braceless `for` case, the depth
// model has no frame for the braceless body, so it would de-indent the `try`
// body and `catch`; the formatter must keep the already-correct layout
// byte-identical.
//
//  1. Exercise the authored command format preserves braceless if try body indent fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves braceless if try body indent and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for a `try`/`catch` nested under a braceless `if` body. Like the braceless `for` case, the depth model has no frame for the braceless body, so it would de-indent the `try` body and `catch`; the formatter must keep the already-correct layout byte-identical. Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesBracelessIfTryBodyIndent owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatPreservesBracelessIfTryBodyIndent(t *testing.T) {
  src := `declare function run(): void;
function g(x: number): void {
  if (x > 0)
    try {
      run();
    } catch (e) {
      console.log(e);
    }
}
`
  assertFormatUnchanged(t, src)
}
