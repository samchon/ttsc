package linthost

import "testing"

// TestFormatSemiPreferNeverStripsBeforeSameLineCloseBrace verifies a `;`
// whose next significant token is a same-line `}` is still stripped
// under semi:false.
//
// The same-line hazard guard must not over-reach: ASI's closing-brace
// rule applies regardless of line structure, so `{ a() }` is valid and
// Prettier prints it without the terminator. This is the negative twin
// of the same-line `else` / `do…while` cases — `}` is the one same-line
// successor that keeps the strip safe.
//
//  1. Parse `if (x) { a(); }` (single line).
//  2. Apply format/semi with prefer:"never".
//  3. Assert the `;` before the same-line `}` is stripped.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove the call terminator before a same-line closing brace under never while preserving the if condition, call and block.
// @evidence contracts/testing.md#independent-expectations The independently authored full output follows ASI closing-brace safety without requiring a line break; the call remains inside the same if body.
// @evidence contracts/testing.md#distinguishing-cases This changed same-line closing-brace successor contrasts with same-line else/do-while or next-statement separators that must remain.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverStripsBeforeSameLineCloseBrace is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only fixture harness invokes the owning semicolon rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiPreferNeverStripsBeforeSameLineCloseBrace(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "if (x) { a(); }\n",
    `{"prefer":"never"}`,
    "if (x) { a() }\n",
  )
}
