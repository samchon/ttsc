package linthost

import "testing"

// TestCommandFormatPreservesBracelessIfTryBodyIndent guards a `try`/`catch`
// nested under a braceless `if` body. Like the braceless `for` case, the depth
// model has no frame for the braceless body, so it would de-indent the `try`
// body and `catch`; the formatter must keep the already-correct layout
// byte-identical.
//
//  1. Seed a function whose braceless `if` body is an indented `try`/`catch`.
//  2. Run `ttsc format` and require the file to stay byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a function whose braceless `if` body is a `try`/`catch`, and requires the whole file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently requires the braceless if's nested try/catch layout, condition and calls to survive unchanged; no independent Prettier invocation establishes these bytes.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case for the braceless-if frame, complementing the braceless-for test. No mis-indented input is repaired here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
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
