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
func TestFormatSemiKeepsSameLineTypeMemberSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "type T = { a: number; b: string };\n",
    `{"prefer":"never"}`,
    "type T = { a: number; b: string }\n",
  )
}
