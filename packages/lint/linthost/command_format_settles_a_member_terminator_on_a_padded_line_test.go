package linthost

import "testing"

// TestCommandFormatSettlesAMemberTerminatorOnAPaddedLine verifies the member
// terminator composes with the pass that rewrites the very bytes it sits on.
//
// The insert is zero-width at the member's End(), and format/whitespace's
// trim deletes the run of spaces that starts at exactly that offset. Two
// edits sharing a start position exercise their composition through the
// command cascade. The final full-file literal requires both trimmed padding
// and the terminator, but does not count passes or prove that neither edit
// was deferred to a later cascade cycle.
//
// The complete authored expectation preserves the interface, member name and
// string type independently of formatter output. No external oracle is run.
//
//  1. Seed an interface member padded with trailing spaces and missing its
//     terminator.
//  2. Run `ttsc format`.
//  3. Assert the line is trimmed and terminated, with no stranded padding
//     between the type and the `;`.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on `interface Shape { value: string   }` where the member has trailing spaces and no terminator, and requires the exact file `value: string;` with the padding removed and the semicolon directly after the type.
// @evidence contracts/testing.md#independent-expectations The expected `interface Shape {\n  value: string;\n}\n` is an independent complete authored literal preserving interface/member/type meaning while requiring both edits; no output is derived from the formatter or an external invocation.
// @evidence contracts/testing.md#distinguishing-cases One changing case exercises a zero-width semicolon insertion and trailing-whitespace trim beginning at the same offset. Permanent omission of either change fails the final whole-file comparison, but the command-level check does not distinguish same-cycle application from recovery in a later cycle or measure edit ordering directly.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatResult; no child process, built binary or installed consumer.
func TestCommandFormatSettlesAMemberTerminatorOnAPaddedLine(t *testing.T) {
  assertFormatResult(
    t,
    "interface Shape {\n  value: string   \n}\n",
    "interface Shape {\n  value: string;\n}\n",
  )
}
