package linthost

import "testing"

// TestUnicornBetterRegexSortCharacterClassesOption verifies the
// `sortCharacterClasses` option gates only the class range-merge/sort
// transform, leaving the shorthand rewrites intact.
//
// Setting the option to `false` blacklists the Go optimizer's named
// `charClassClassrangesMerge`, so a purely reordering optimization
// (`[GgHhIi...]`) is suppressed while a shorthand that also shortens the class
// (`[a0-9b]` -> `[a\db]`) still fires. The two cases under the same option pin
// both halves: the disabled transform stays disabled, and the unrelated
// transforms keep running.
//
//  1. With the option off, assert `[a0-9b]` still gets its `\d` shorthand.
//  2. With the option off, assert a sort-only class is left unchanged.
//
// @evidence contracts/testing.md#behavioral-verification the option-aware fix and no-finding helpers verify disabling class sorting does not disable digit shorthand rewriting.
// @evidence contracts/testing.md#independent-expectations The authored [a\db] fixed output and unchanged class specify the two option outcomes independently of the Go optimizer, without claiming upstream execution.
// @evidence contracts/testing.md#distinguishing-cases With the same sortCharacterClasses:false option, digit shortening still acts while pure class rearrangement does not; TestUnicornBetterRegex owns default sorting.
// @evidence contracts/testing.md#execution-ownership Both option-controlled sources execute in this named Go unit entry; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
func TestUnicornBetterRegexSortCharacterClassesOption(t *testing.T) {
  const disableSort = `{"sortCharacterClasses": false}`

  assertFixSnapshotWithOptions(
    t,
    unicornBetterRegexRuleName,
    "const foo = /[a0-9b]/;\n",
    disableSort,
    "const foo = /[a\\db]/;\n",
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornBetterRegexRuleName,
    "const foo = /[GgHhIiå.Z:a-f\"0-8%A*ä]/;\n",
    disableSort,
  )
}
