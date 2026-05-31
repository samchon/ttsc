package linthost

import "testing"

// TestCommandFormatPreservesBracelessIfTryBodyIndent guards a `try`/`catch`
// nested under a braceless `if` body. Like the braceless `for` case, the depth
// model has no frame for the braceless body, so it would de-indent the `try`
// body and `catch`; the formatter must keep the already-correct layout
// byte-identical.
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
