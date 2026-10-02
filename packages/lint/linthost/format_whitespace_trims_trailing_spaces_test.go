package linthost

import "testing"

// TestFormatWhitespaceTrimsTrailingSpaces verifies formatWhitespace
// deletes spaces and tabs left before a line's newline.
//
// Trailing whitespace is invisible noise Prettier always strips. This
// pins operation (a): the run after the statement's `;` and before the
// `\n` is removed without touching the statement.
//
//  1. Parse a statement followed by two trailing spaces.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the trailing spaces are gone.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must trim real source-line spaces and tabs while retaining both const declarations and LF endings.
// @evidence contracts/testing.md#independent-expectations Complete literal outputs preserve a=1 and b=2 and remove only their source-tail whitespace; template payload has a separate preservation oracle.
// @evidence contracts/testing.md#distinguishing-cases The original space-only and added mixed tab/space tails change; clean-source negatives and template-owned tails distinguish where trimming is forbidden.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceTrimsTrailingSpaces is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceTrimsTrailingSpaces(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;  \nconst b = 2;\n",
    "const a = 1;\nconst b = 2;\n",
  )
  assertFixSnapshot(t, "format/whitespace", "const a = 1;\t \nconst b = 2;\n", "const a = 1;\nconst b = 2;\n")
}
