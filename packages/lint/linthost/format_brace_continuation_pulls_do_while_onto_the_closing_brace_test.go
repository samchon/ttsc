package linthost

import "testing"

// TestFormatBraceContinuationPullsDoWhileOntoTheClosingBrace verifies a do-loop's `while` joins the closing brace of a block body.
//
// The `while` of a do-loop is a continuation keyword like `else`, not a loop
// header, and it is the one whose own statement kind differs from the clause it
// continues.
//
//  1. Parse a `do` whose `while` starts its own line after a block body.
//  2. Apply format/brace-continuation.
//  3. Assert `while` joins the closing brace line.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must join a do-loop while to the closing brace of its block body without changing the body call or condition.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves tick, ready and the loop semicolon and follows the supported block-body } while placement.
// @evidence contracts/testing.md#distinguishing-cases This block do-loop positive complements pushing while after a non-block body, distinguishing clause kind rather than the shared keyword spelling.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationPullsDoWhileOntoTheClosingBrace is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationPullsDoWhileOntoTheClosingBrace(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "do {\n  tick();\n}\nwhile (ready);\n",
    `{"tabWidth":2}`,
    "do {\n  tick();\n} while (ready);\n",
  )
}
