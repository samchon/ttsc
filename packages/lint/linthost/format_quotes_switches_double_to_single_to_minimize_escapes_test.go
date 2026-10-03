package linthost

import "testing"

// TestFormatQuotesSwitchesDoubleToSingleToMinimizeEscapes verifies the
// rule flips an already-double-quoted literal to single quotes when that
// strictly reduces escapes, even under the default prefer:"double".
//
// The supported policy chooses fewer required escapes before applying
// delimiter preference on a tie. This already-double positive requires
// the strictly cheaper single form; it does not execute an earlier
// single-to-double-only implementation.
//
//  1. Parse a source file with a double-quoted literal holding one
//     escaped double quote.
//  2. Apply the rule through the disk-backed fixer (default options).
//  3. Assert the literal is rewritten to the zero-escape single-quoted
//     form.
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must switch a double-quoted double-quote payload to single quotes even under the default double preference.
// @evidence contracts/testing.md#independent-expectations The complete output literal retains the cooked one-double-quote value and declaration while reducing one required escape to zero; minimum escapes outranks delimiter preference.
// @evidence contracts/testing.md#distinguishing-cases This strict-cost positive complements the already-double escape-tie negative and the symmetric prefer:single override, distinguishing cost minimization from always honoring preference.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesSwitchesDoubleToSingleToMinimizeEscapes is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal inputs and complete output assertions; the shared syntax-only harness invokes the owning rule and applies source edits in process without a consumer install, native product build or product host.
func TestFormatQuotesSwitchesDoubleToSingleToMinimizeEscapes(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/quotes",
    `const s = "\"";`+"\n",
    `const s = '"';`+"\n",
  )
}
