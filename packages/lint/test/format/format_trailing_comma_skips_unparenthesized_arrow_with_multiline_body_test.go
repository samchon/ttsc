package linthost

import "testing"

// TestFormatTrailingCommaSkipsUnparenthesizedArrowWithMultilineBody verifies
// the rule does not insert a trailing comma after the parameter of an
// unparenthesized single-parameter arrow whose body spans multiple lines.
//
// An unparenthesized arrow (`a => …`) has no opening or closing paren around
// its parameter list. Before `findCloseTokenAfter` was tightened to bail on
// the first non-trivia byte after `list.End()`, the scanner walked past `=>`
// and the body until it found a `)` belonging to an unrelated expression
// (e.g. an inner call in the body), at which point the multi-line check
// passed and the rule inserted `,` after the single parameter — producing
// the syntax error `a, =>`. Pinning the skip here guards both the standalone
// `const f = a => {…}` shape and the call-wrapped `xs.map(a => …)` shape,
// since both arrive at `considerFunctionParameterComma` through the same
// `KindArrowFunction` dispatch arm.
//
//  1. Parse a source file with one unparenthesized-arrow whose body contains
//     a `)` on a later line.
//  2. Run the engine with formatTrailingComma enabled.
//  3. Assert zero findings — the inner call already carries its own trailing
//     comma, so silence on the arrow's parameter list is the entire signal.
func TestFormatTrailingCommaSkipsUnparenthesizedArrowWithMultilineBody(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "formatTrailingComma",
    "declare function foo(x: number): number;\nconst f = a => {\n  return foo(\n    a,\n  );\n};\nf;\n",
  )
}
