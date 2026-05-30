package linthost

import "testing"

// TestCommandFormatPreservesBracelessForBodyIndent guards a `try`/`catch`
// nested under a braceless `for` body. The block-depth model has no frame for
// a braceless body, so it would de-indent the `try` body and `catch` clause;
// the formatter must keep the already-correct layout byte-identical.
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
