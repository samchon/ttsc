package linthost

import "testing"

// TestFormatIndentHonorsCustomTabWidth verifies the rule scales the
// space indent by a custom `tabWidth`.
//
// Under tabWidth 4 a depth-1 statement sits at four spaces, not the
// default two. This pins that `format/indent` multiplies depth by the
// configured tabWidth.
//
//  1. Parse a function whose body statement is flush left.
//  2. Apply the rule with `{"tabWidth":4}` through the disk-backed fixer.
//  3. Assert the body statement is indented to four spaces.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must indent the flush-left return by four spaces when tabWidth is four. The complete source snapshot distinguishes ignoring the custom option and preserves the return value and function structure.
// @evidence contracts/testing.md#independent-expectations The supported tabWidth option sets the space count for one ordinary block level. The literal four-space output is authored from that option contract without calling the implementation layout renderer.
// @evidence contracts/testing.md#distinguishing-cases This positive owns custom four-space indentation; NormalizesOverIndentedBlockStatement supplies default two-space behavior and HonorsUseTabsOption supplies the distinct tab character mode.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentHonorsCustomTabWidth owns its source, option and expected bytes in the public Go unit population. The syntax-only owning rule and disk-backed edit application run in the same process without consumer installation, native artifact production or a product host.
func TestFormatIndentHonorsCustomTabWidth(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/indent",
    "function f() {\nreturn 1;\n}\n",
    `{"tabWidth":4}`,
    "function f() {\n    return 1;\n}\n",
  )
}
