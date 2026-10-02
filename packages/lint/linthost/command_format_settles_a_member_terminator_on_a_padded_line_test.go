package linthost

import "testing"

// TestCommandFormatSettlesAMemberTerminatorOnAPaddedLine verifies the member
// terminator composes with the pass that rewrites the very bytes it sits on.
//
// The insert is zero-width at the member's End(), and format/whitespace's
// trim deletes the run of spaces that starts at exactly that offset. Two
// edits sharing a start position are what the applier's coincidence rule
// governs, so this pins the composition rather than assuming it: the trim
// applies first (it ends later, so it sorts later and applies earlier under
// the reverse-order applier) and the `;` lands on the trimmed line, in one
// pass and with neither edit dropped.
//
// The settled shape is also Prettier 3.8.3's own output for this input, so
// the two passes together land on the oracle rather than on a merely
// self-consistent result.
//
//  1. Seed an interface member padded with trailing spaces and missing its
//     terminator.
//  2. Run `ttsc format`.
//  3. Assert the line is trimmed and terminated, with no stranded padding
//     between the type and the `;`.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on `interface Shape { value: string   }` where the member has trailing spaces and no terminator, and requires the exact file `value: string;` with the padding removed and the semicolon directly after the type.
// @evidence contracts/testing.md#independent-expectations The expected `interface Shape {\n  value: string;\n}\n` is an authored literal that the test comment attributes to Prettier 3.8.3 (not re-verified here); it is not derived from formatter output.
// @evidence contracts/testing.md#distinguishing-cases One changing case where two edits share a start offset (the zero-width semicolon insert and the trailing-whitespace trim), so dropping either edit or applying them in the wrong order leaves padding before the `;` or no `;`.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatResult; no child process, built binary or installed consumer.
func TestCommandFormatSettlesAMemberTerminatorOnAPaddedLine(t *testing.T) {
  assertFormatResult(
    t,
    "interface Shape {\n  value: string   \n}\n",
    "interface Shape {\n  value: string;\n}\n",
  )
}
