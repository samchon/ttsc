package linthost

import "testing"

// TestFormatSemiInsertsAfterMissingTerminator verifies formatSemi inserts a
// missing trailing semicolon on a simple expression statement.
//
// The rule inserts at the statement's End position. This full-output
// assertion owns placement, not interaction with every other rule's edit.
// One ExpressionStatement with no trailing
// semicolon becomes the same statement with the terminator appended.
//
// 1. Parse a source file with one terminator-less expression statement.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the expected `;` at the new end.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must append a missing semicolon to JSON.stringify(1) without changing the call or its LF ending.
// @evidence contracts/testing.md#independent-expectations The independent full source literal specifies the default statement terminator and identical call payload; an unchanged or displaced insertion fails the exact output comparison.
// @evidence contracts/testing.md#distinguishing-cases This simple changed expression positive complements already-terminated statement negatives and the fourteen-kind exact insertion matrix.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiInsertsAfterMissingTerminator is a selected public Go unit under the lint semantic-unit Evidence claim. The shared syntax-only fixture harness calls the owning semicolon rule and applies edits for the complete literal output assertion in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiInsertsAfterMissingTerminator(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "JSON.stringify(1)\n",
    "JSON.stringify(1);\n",
  )
}
