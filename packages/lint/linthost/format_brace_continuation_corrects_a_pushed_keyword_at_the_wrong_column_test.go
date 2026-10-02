package linthost

import "testing"

// TestFormatBraceContinuationCorrectsAPushedKeywordAtTheWrongColumn verifies a keyword already on its own line at the wrong column is corrected.
//
// The push-down direction owns the whole gap, not only the missing line break.
// Ceding the keyword's own column to format/indent left a stray indent standing
// forever, because that rule never visits a continuation-keyword line.
//
//  1. Parse an `if`/`else` whose `else` sits on its own line with a stray indent.
//  2. Apply format/brace-continuation.
//  3. Assert the keyword moves to the statement's column.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must move an already-split else from its stray three-space column to the owning top-level if column.
// @evidence contracts/testing.md#independent-expectations The complete literal output retains condition a and calls x/y and removes only the incorrect continuation indent; the supported policy aligns a pushed keyword with its statement.
// @evidence contracts/testing.md#distinguishing-cases This wrong-column positive differs from the missing-line-break positive; the split canonical negative owns the correct column, and the nested positive makes nonzero owning indentation observable.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationCorrectsAPushedKeywordAtTheWrongColumn is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationCorrectsAPushedKeywordAtTheWrongColumn(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x();\n   else y();\n",
    `{"tabWidth":2}`,
    "if (a) x();\nelse y();\n",
  )
}
