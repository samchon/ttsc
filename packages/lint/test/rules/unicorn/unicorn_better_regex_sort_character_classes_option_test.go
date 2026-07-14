package linthost

import "testing"

// TestUnicornBetterRegexSortCharacterClassesOption verifies the
// `sortCharacterClasses` option gates only the class range-merge/sort
// transform, leaving the shorthand rewrites intact.
//
// Setting the option to `false` blacklists regexp-tree's
// `charClassClassrangesMerge`, so a purely reordering optimization
// (`[GgHhIi...]`) is suppressed while a shorthand that also shortens the class
// (`[a0-9b]` -> `[a\db]`) still fires. The two cases under the same option pin
// both halves: the disabled transform stays disabled, and the unrelated
// transforms keep running.
//
//  1. With the option off, assert `[a0-9b]` still gets its `\d` shorthand.
//  2. With the option off, assert a sort-only class is left unchanged.
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
