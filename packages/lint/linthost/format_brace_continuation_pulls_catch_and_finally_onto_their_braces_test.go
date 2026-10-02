package linthost

import "testing"

// TestFormatBraceContinuationPullsCatchAndFinallyOntoTheirBraces verifies `catch` and `finally` join the brace before them.
//
// `finally` is the case a node-kind test gets wrong: it follows a catch clause,
// which is not itself a block and always ends in one, so asking whether the
// preceding clause IS a block sends it down the push-down path and strands it on
// its own line.
//
//  1. Parse a `try` whose `catch` and `finally` each start their own line.
//  2. Apply format/brace-continuation.
//  3. Assert both keywords join the brace before them.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must join both catch and finally to their preceding closing braces while retaining all try/catch/finally bodies.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves calls x/y/z and the error binding and follows supported } catch and } finally placement; finally follows a CatchClause holder rather than a Block node.
// @evidence contracts/testing.md#distinguishing-cases This two-keyword positive exercises try-to-catch and catch-to-finally edges together; the no-catch finally test separately owns the direct try-block edge.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationPullsCatchAndFinallyOntoTheirBraces is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationPullsCatchAndFinallyOntoTheirBraces(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "try {\n  x();\n}\ncatch (error) {\n  y();\n}\nfinally {\n  z();\n}\n",
    `{"tabWidth":2}`,
    "try {\n  x();\n} catch (error) {\n  y();\n} finally {\n  z();\n}\n",
  )
}
