package linthost

import "testing"

// TestFormatIndentCaseBlockBodyMatchesCaseDepth verifies a statement
// inside an explicit `case X: { ... }` block is indented to the case
// body's depth, not one level deeper.
//
// Prettier indents `case X: { stmt }` exactly like `case X: stmt`: the
// explicit block adds no indent level. format/indent previously counted
// the case clause AND the block, over-indenting the body by one level
// (corrupting correct source and diverging from Prettier on vscode/vue
// switch statements).
//
//  1. Parse a switch whose case body is a block with an over-indented
//     statement.
//  2. Apply format/indent (tabWidth 2).
//  3. Assert the statement lands at the case-body depth (4), not 6.
func TestFormatIndentCaseBlockBodyMatchesCaseDepth(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/indent",
    "switch (s) {\n  case A: {\n        doThing()\n  }\n}\n",
    `{"tabWidth":2}`,
    "switch (s) {\n  case A: {\n    doThing()\n  }\n}\n",
  )
}
