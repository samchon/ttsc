package linthost

import "testing"

// TestUnicornNumberLiteralCaseFixesLiteralsInEverySyntacticPosition verifies the
// rule fixes the six authored numeric-token positions, beyond a value
// initializer.
//
// The rule dispatches on the literal kind rather than on its parent, so a
// literal type, an enum initializer, a numeric property key, a template
// substitution, and a JSX attribute expression are all in scope. Each position
// is a different parent shape whose text range the autofix must land inside
// exactly; an off-by-one there would eat the surrounding `{`, `,`, or `}`. A
// literal behind a leading comment pins the same range against the node's Pos,
// which starts at the trivia rather than at the token.
//
//  1. Fix a literal in a type, enum, key, template-substitution, and
//     comment-preceded position through the standard TS path.
//  2. Fix a literal in a JSX attribute through the TSX path.
//  3. Assert every rewritten source keeps its surrounding syntax intact.
//
// @evidence contracts/testing.md#behavioral-verification exact fix snapshots preserve surrounding syntax in six distinct numeric-token positions.
// @evidence contracts/testing.md#independent-expectations Authored whole-source outputs encode case-only canonicalization while retaining parent tokens and trivia independently of the scanner.
// @evidence contracts/testing.md#distinguishing-cases Type literal, enum, object key, template substitution, preceding comment and TSX attribute all change safely;
// @evidence contracts/testing.md#execution-ownership TestUnicornNumberLiteralCaseFixesLiteralsInEverySyntacticPosition is a discoverable Go unit host; owning engine and fixer operations run its literal fixtures in the shared process without installation, native builds or product children. Failures retain the source and literal expected replacement or finding identity.
func TestUnicornNumberLiteralCaseFixesLiteralsInEverySyntacticPosition(t *testing.T) {
  for _, testCase := range []struct {
    source   string
    expected string
  }{
    {source: "type Big = 0XFF;\n", expected: "type Big = 0xFF;\n"},
    {source: "enum E {\n  A = 1E3,\n}\n", expected: "enum E {\n  A = 1e3,\n}\n"},
    {source: "const o = { 1E3: true };\n", expected: "const o = { 1e3: true };\n"},
    {source: "const s = `${1E3}`;\n", expected: "const s = `${1e3}`;\n"},
    {source: "const c = /* hex */ 0Xff;\n", expected: "const c = /* hex */ 0xFF;\n"},
  } {
    assertFixSnapshot(
      t,
      unicornNumberLiteralCaseRuleName,
      testCase.source,
      testCase.expected,
    )
  }
  assertFixSnapshotFile(
    t,
    unicornNumberLiteralCaseRuleName,
    "main.tsx",
    "const el = <div tabIndex={1E3} />;\n",
    "const el = <div tabIndex={1e3} />;\n",
  )
}
