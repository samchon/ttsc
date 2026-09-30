package linthost

import "testing"

// TestFormatBraceContinuationIndentsAPushedKeywordToItsStatement verifies a pushed-down keyword lands at its statement's column.
//
// The synthesized line break carries an indent, and taking it from the wrong
// place is invisible at top level, where the indent is empty. Nesting the
// statement is what makes a zero-column result wrong.
//
//  1. Parse a one-line `if`/`else` nested inside a function body.
//  2. Apply format/brace-continuation.
//  3. Assert `else` lands at the enclosing statement's column.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must push else onto a new line at the nested if statement's two-space indentation.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves the enclosing function, condition and both calls, with else aligned to its owning if under the supported continuation placement policy.
// @evidence contracts/testing.md#distinguishing-cases This nonzero-indent positive distinguishes copying the owning statement column from always using column zero; the top-level push and wrong-column correction cover neighboring placement decisions.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationIndentsAPushedKeywordToItsStatement is a public Go unit selected by TestSelectedLintUnits. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationIndentsAPushedKeywordToItsStatement(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "function f() {\n  if (a) x(); else y();\n}\n",
    `{"tabWidth":2}`,
    "function f() {\n  if (a) x();\n  else y();\n}\n",
  )
}
