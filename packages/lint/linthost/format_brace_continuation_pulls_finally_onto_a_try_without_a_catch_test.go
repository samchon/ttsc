package linthost

import "testing"

// TestFormatBraceContinuationPullsFinallyOntoATryWithoutACatch verifies `finally` follows the try block when there is no catch.
//
// The `finally` keyword takes the try block as its preceding clause only when no
// catch clause exists, and every other case pins the catch-clause path instead.
// Without this the try-block fallback is unexercised.
//
//  1. Parse a `try`/`finally` with no catch clause and `finally` on its own line.
//  2. Apply format/brace-continuation.
//  3. Assert `finally` joins the try block's closing brace.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must join finally to its try block when no catch clause is present.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves the try/finally calls and braces and changes only the newline before finally to one space under the supported continuation policy.
// @evidence contracts/testing.md#distinguishing-cases This no-catch positive owns the direct TryBlock-to-finally edge; the catch/finally positive owns the CatchClause-to-finally edge and retains both separately.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationPullsFinallyOntoATryWithoutACatch is a public Go unit selected by TestSelectedLintUnits. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationPullsFinallyOntoATryWithoutACatch(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "try {\n  x();\n}\nfinally {\n  z();\n}\n",
    `{"tabWidth":2}`,
    "try {\n  x();\n} finally {\n  z();\n}\n",
  )
}
