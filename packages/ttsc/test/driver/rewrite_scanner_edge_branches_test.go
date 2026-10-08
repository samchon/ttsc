package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteScannerEdgeBranches Verifies the shared upstream lexical
// owner rejects malformed emitted JavaScript rather than splicing recovered AST.
//
// The output rewriter must not use parser recovery positions as certified call
// ranges. Valid literal, comment and template syntax has public emit/runtime
// coverage; these malformed inputs exercise direct defensive rejection.
//
// 1. Supply unterminated arguments, strings, templates, comments and regex literals.
// 2. Invoke the actual output-rewrite owner for each independent input.
// 3. Require no output and an invalid-JavaScript error.
//
// @evidence contracts/testing.md#behavioral-verification applyRewrites rejects each malformed output with no output and an explicit invalid emitted JavaScript error; the retained root-only error label remains literal plugin.
// @evidence contracts/testing.md#independent-expectations Authored missing delimiters and illegal literal newlines are invalid JavaScript independently of the rewriter; absent output and required rejection distinguish an unsafe splice through parser recovery.
// @evidence contracts/testing.md#distinguishing-cases Missing call close and unterminated quoted, multiline quoted, template, template substitution, block comment and regex inputs cover distinct lexical recovery branches. Valid public emission and inert/live contrasts are owned by TestDriverRewriteLexicalIdentityRuntime.
// @evidence contracts/testing.md#execution-ownership Go discovers this direct unit under test/driver; rewriteTextForTest invokes the actual output owner with a parsed filename identity and authored output text, without building a host or installing a consumer.
func TestDriverRewriteScannerEdgeBranches(t *testing.T) {
  if got := joinRootAndNamespaces(driver.Rewrite{RootName: "plugin"}); got != "plugin" {
    t.Fatalf("root-only join mismatch: %q", got)
  }
  for _, input := range []string{
    "plugin.make(",
    `plugin.make("unterminated)`,
    "plugin.make(\"line\nbreak\")",
    "plugin.make(`unterminated)",
    "plugin.make(`value ${1)",
    "plugin.make(/* unterminated",
    "plugin.make(/unterminated",
    "plugin.make(/line\nbreak/)",
  } {
    t.Run(input, func(t *testing.T) {
      got, err := rewriteTextForTest(input, driver.Rewrite{RootName: "plugin", Method: "make", Replacement: "replacement", ConsumeParens: true})
      if got != "" || err == nil || !strings.Contains(err.Error(), "invalid emitted JavaScript") {
        t.Fatalf("malformed output: got=%q err=%v", got, err)
      }
    })
  }
}
