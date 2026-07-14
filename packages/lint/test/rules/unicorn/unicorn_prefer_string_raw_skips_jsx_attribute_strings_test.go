package linthost

import "testing"

// TestUnicornPreferStringRawSkipsJsxAttributeStrings verifies the rule stays
// silent on a JSX attribute value.
//
// Upstream exempts JSX attribute values by position, because JSX strings have
// no escape sequences: `title="C:\\Users"` really does hold two backslashes,
// and a `String.raw` template would halve them. The value comparison reaches
// the same verdict from the value side — the scanner cooks a JSX attribute
// string verbatim, so its cooked text keeps the doubled backslash the unescape
// drops — which is exactly why the comparison must stay in place for TSX.
//
//  1. Parse a TSX fixture whose annotated line is an ordinary string literal.
//  2. Give a JSX attribute the same backslash-escaped path as its value.
//  3. Assert only the ordinary literal reports.
func TestUnicornPreferStringRawSkipsJsxAttributeStrings(t *testing.T) {
  assertRuleCorpusCaseTSX(
    t,
    "unicorn/prefer-string-raw-jsx-attribute.tsx",
    "// expect: unicorn/prefer-string-raw error\n"+
      "const path = \"C:\\\\Users\\\\me\";\n"+
      "const element = <div title=\"C:\\\\Users\\\\me\" />;\n",
  )
}
