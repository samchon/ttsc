package linthost

import "testing"

// TestFormatPrintWidthKeepsCallWithTrailingLineCommentInline verifies the
// rule abstains on a call expression whose only overflow is a trailing
// `//` line comment that follows the closing paren.
//
// Pins Prettier 3 parity. A line comment runs to the end of the source
// line by definition, so breaking the call expression to make the
// comment fit never helps. The rule used to count the comment bytes
// inside `trailingLineWidth`, which subtracted them from the layout
// budget on the shrunk re-render and forced an over-break of short
// calls. That is the typeorm `comment.replaceAll("nul", "") // Null
// bytes' shape that pushed `formatPrintWidth: 'off'` onto the
// ttsc-lint branch of the benchmark.
//
//  1. Configure printWidth=30 — large enough that the call plus its
//     statement-terminating `;` still fit (25 columns).
//  2. Feed `myCall(arg1, arg2, arg3); // hi` (31 columns) so the
//     trailing line comment is the only thing overflowing.
//  3. Assert the rule emits zero findings; the call stays flat.
func TestFormatPrintWidthKeepsCallWithTrailingLineCommentInline(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "myCall(arg1, arg2, arg3); // hi\n",
    `{"printWidth": 30}`,
  )
}
