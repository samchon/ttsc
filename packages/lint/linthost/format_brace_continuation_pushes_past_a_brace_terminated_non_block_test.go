package linthost

import "testing"

// TestFormatBraceContinuationPushesPastABraceTerminatedNonBlock verifies a consequent that ends in a brace but is not a block still pushes down.
//
// A `switch` consequent has the same final `}` byte as a block but a different
// AST kind. The full expected source requires a newline before `else`, so
// always joining after a closing-brace byte cannot satisfy this case and the
// block-consequent companion together.
//
//  1. Parse an `if` whose consequent is a `switch` statement, with `else` inline.
//  2. Apply format/brace-continuation.
//  3. Assert `else` moves to its own line rather than onto the closing brace.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must push else after a switch consequent even though that non-block statement ends with a closing brace.
// @evidence contracts/testing.md#independent-expectations The complete literal output retains both conditions, the empty switch body and y call; the supported clause-kind policy puts else on its own line rather than treating every closing-brace byte as a Block.
// @evidence contracts/testing.md#distinguishing-cases This brace-terminated SwitchStatement positive is the adjacent kind counterexample to block-else pull-up, preventing a last-byte heuristic from passing both.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationPushesPastABraceTerminatedNonBlock is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationPushesPastABraceTerminatedNonBlock(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) switch (b) {\n} else y();\n",
    `{"tabWidth":2}`,
    "if (a) switch (b) {\n}\nelse y();\n",
  )
}
