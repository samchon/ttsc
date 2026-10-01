package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsIgnoresDetachedJSDocWhenDecidingFixSafety verifies that actual fix execution compares each named detached-comment case with authored full output.
//
// A detached or different-name tag does not document the binding, independently allowing its safe rename while preserving comment text.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution compares each named detached-comment case with authored full output.
// @evidence contracts/testing.md#independent-expectations A detached or different-name tag does not document the binding, independently allowing its safe rename while preserving comment text.
// @evidence contracts/testing.md#distinguishing-cases Blank/Unicode-blank separation, intervening ordinary comment and longer @parameter tag retain distinct safe outputs.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsIgnoresDetachedJSDocWhenDecidingFixSafety owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsIgnoresDetachedJSDocWhenDecidingFixSafety(t *testing.T) {
  cases := []struct {
    name   string
    source string
    want   string
  }{
    {
      name:   "blank line",
      source: "/** @param err historical text */\n\nfunction log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
      want:   "/** @param err historical text */\n\nfunction log(error: Error): void {\n  console.error(error);\n}\nvoid log;\n",
    },
    {
      name:   "Unicode blank line",
      source: "/** @param err historical text */\u2028\u2028function log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
      want:   "/** @param err historical text */\u2028\u2028function log(error: Error): void {\n  console.error(error);\n}\nvoid log;\n",
    },
    {
      name:   "ordinary intervening comment",
      source: "/** @param err historical text */\n/* ordinary */\nfunction log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
      want:   "/** @param err historical text */\n/* ordinary */\nfunction log(error: Error): void {\n  console.error(error);\n}\nvoid log;\n",
    },
    {
      name:   "longer tag name",
      source: "/** @parameter err historical text */\nfunction log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
      want:   "/** @parameter err historical text */\nfunction log(error: Error): void {\n  console.error(error);\n}\nvoid log;\n",
    },
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      assertFixSnapshot(t, unicornPreventAbbreviationsRuleName, testCase.source, testCase.want)
    })
  }
}
