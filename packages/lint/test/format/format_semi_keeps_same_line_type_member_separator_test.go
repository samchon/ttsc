package linthost

import "testing"

// TestFormatSemiKeepsSameLineTypeMemberSeparator verifies a `;` that
// separates two type-literal members on the SAME line is kept, while the
// type alias's own statement terminator is stripped.
//
// The semi rule never inserts the line break that would let ASI replace
// a same-line separator, so dropping the inner `;` in
// `{ a: number; b: string }` would corrupt the type. Only the outer
// statement `;` (after `}`) is ASI-safe to remove.
//
//  1. Parse a single-line type alias with two members.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the inner separator stays and the trailing statement `;` is
//     removed.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must keep the same-line type-member semicolon while removing the safe outer alias terminator under never.
// @evidence contracts/testing.md#independent-expectations The independent full literal output retains the separator needed between a:number and b:string but drops only the alias-ending punctuation.
// @evidence contracts/testing.md#distinguishing-cases A required interior separator and optional exterior terminator share one changed/unchanged fixture, contrasting with broken newline-separated member stripping.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsSameLineTypeMemberSeparator is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness invokes the owning semicolon rule and applies edits for exact output in the same Go process, without consumer installation, a native product build or host execution.
func TestFormatSemiKeepsSameLineTypeMemberSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "type T = { a: number; b: string };\n",
    `{"prefer":"never"}`,
    "type T = { a: number; b: string }\n",
  )
}
