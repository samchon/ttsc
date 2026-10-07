package linthost

import "testing"

// TestCommandFormatPreservesBracelessForBodyIndent guards a `try`/`catch`
// nested under a braceless `for` body. The block-depth model has no frame for
// a braceless body, so it would de-indent the `try` body and `catch` clause;
// the formatter must keep the already-correct layout byte-identical.
//
//  1. Seed a function whose braceless `for` body is an indented `try`/`catch`.
//  2. Run `ttsc format` and require the file to stay byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on a function whose braceless `for` body is a `try`/`catch` indented one level deeper, and requires the whole file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently requires the braceless for's nested try/catch layout, query binding and calls to survive unchanged; it is not derived from formatter output or an independent Prettier invocation.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case for the braceless-for frame, guarding against a depth model that de-indents the `try` body and `catch` clause. The braceless-if sibling is a separate test and no mis-indented input is repaired here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatPreservesBracelessForBodyIndent(t *testing.T) {
  assertFormatUnchanged(t, `declare function run(q: string): Promise<void>;
async function execute(queries: string[]): Promise<void> {
  for (const query of queries)
    try {
      await run(query);
    } catch (e) {
      console.log(e);
    }
}
`)
}
