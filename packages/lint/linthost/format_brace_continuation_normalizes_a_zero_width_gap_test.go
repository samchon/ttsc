package linthost

import "testing"

// TestFormatBraceContinuationNormalizesAZeroWidthGap verifies a keyword written flush against the brace gains its space.
//
// The empty gap is the boundary of the pull-up direction and the only input that
// produces a zero-width edit range, the shape the applier has dedicated coincident
// insert handling for.
//
//  1. Parse an `if`/`else` written as `}else{` with no gap at all.
//  2. Apply format/brace-continuation.
//  3. Assert one space appears between the brace and the keyword.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must insert one space at the zero-width gap between a block's closing brace and its adjacent else.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves both clause bodies and changes only }else to } else according to the supported block-continuation policy.
// @evidence contracts/testing.md#distinguishing-cases This empty-gap insertion boundary differs from a multiline pull-up deletion; canonical joined syntax owns the negative and statement-body pushing owns the other direction.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationNormalizesAZeroWidthGap is a public Go unit selected by TestSelectedLintUnits. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationNormalizesAZeroWidthGap(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n}else {\n  y();\n}\n",
    `{"tabWidth":2}`,
    "if (a) {\n  x();\n} else {\n  y();\n}\n",
  )
}
