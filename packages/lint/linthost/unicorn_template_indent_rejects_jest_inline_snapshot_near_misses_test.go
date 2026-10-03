package linthost

import (
  "testing"
)

// TestUnicornTemplateIndentRejectsJestInlineSnapshotNearMisses verifies that the actual rule requires silence for each named nonmatching inline snapshot call shape.
//
// The supported direct expect/snapshot call grammar independently excludes missing/extra arguments and wrong/member/computed/optional callees.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The actual rule requires silence for each named nonmatching inline snapshot call shape.
// @evidence contracts/testing.md#independent-expectations The supported direct expect/snapshot call grammar independently excludes missing/extra arguments and wrong/member/computed/optional callees.
// @evidence contracts/testing.md#distinguishing-cases Six named near-misses remain distinct; AcceptsParenthesizedJestInlineSnapshot supplies the adjacent accepted selection.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentRejectsJestInlineSnapshotNearMisses owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentRejectsJestInlineSnapshotNearMisses(t *testing.T) {
  cases := []struct {
    name   string
    source string
  }{
    {name: "expect has no argument", source: "expect().toMatchInlineSnapshot(`\n        one\n        `);\n"},
    {name: "snapshot has extra argument", source: "expect(value).toMatchInlineSnapshot(`\n        one\n        `, extra);\n"},
    {name: "wrong expect name", source: "notExpect(value).toMatchInlineSnapshot(`\n        one\n        `);\n"},
    {name: "member expect", source: "assert.expect(value).toMatchInlineSnapshot(`\n        one\n        `);\n"},
    {name: "computed snapshot method", source: "expect(value)[\"toMatchInlineSnapshot\"](`\n        one\n        `);\n"},
    {name: "optional snapshot call", source: "expect(value).toMatchInlineSnapshot?.(`\n        one\n        `);\n"},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleSkipsSource(t, unicornTemplateIndentRuleName, test.source)
    })
  }
}
