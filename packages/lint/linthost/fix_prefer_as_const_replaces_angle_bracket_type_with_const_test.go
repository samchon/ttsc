package linthost

import "testing"

// TestFixPreferAsConstReplacesAngleBracketTypeWithConst verifies the preferAsConst fixer on `<T>` assertions.
//
// The angle-bracket assertion shares the assertion code path with `as`, but
// its literal type sits between `<` and `>` before the expression. The fix
// must swap only that type token for `const`, producing `<const>expr` the
// way the upstream rule's fixer does.
//
// 1. Parse a source file with `<"literal">"literal"`.
// 2. Apply the preferAsConst finding through the disk-backed fixer.
// 3. Assert only the bracketed type changed to `const`.
//
// @evidence contracts/testing.md#behavioral-verification prefer-as-const changes the angle-bracket literal type to const while retaining the expression.
// @evidence contracts/testing.md#independent-expectations The authored <const> literal result independently specifies only the type-position replacement.
// @evidence contracts/testing.md#distinguishing-cases Angle-bracket assertion syntax differs from as syntax and is exercised in ordinary TS grammar.
// @evidence contracts/testing.md#execution-ownership TestFixPreferAsConstReplacesAngleBracketTypeWithConst calls assertFixSnapshot for its bracketed assertion.
func TestFixPreferAsConstReplacesAngleBracketTypeWithConst(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "const value = <\"literal\">\"literal\";\nJSON.stringify(value);\n",
    "const value = <const>\"literal\";\nJSON.stringify(value);\n",
  )
}
