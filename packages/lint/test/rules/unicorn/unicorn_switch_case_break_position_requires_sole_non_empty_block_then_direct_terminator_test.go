package linthost

import (
  "testing"
)

// TestUnicornSwitchCaseBreakPositionRequiresSoleNonEmptyBlockThenDirectTerminator verifies the matcher requires exactly one nonempty block and direct terminator.
//
// The supported structural predicate independently defines which literal clause shapes are candidates, without using the product matcher to generate expectations.
//
// 1. Execute the retained clause or command fixture through the owning Go operation.
// 2. Compare the authored report, edit or preserved-file result for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution requires silence for all eight nonmatching shapes, detecting an overbroad placement matcher.
// @evidence contracts/testing.md#independent-expectations The supported structural predicate independently defines which literal clause shapes are candidates, without using the product matcher to generate expectations.
// @evidence contracts/testing.md#distinguishing-cases All retained empty/nonsole/nondirect and already-correct clause shapes remain clean; ReportsEverySupportedTerminatorAtExactRange owns direct matching counterparts.
// @evidence contracts/testing.md#execution-ownership TestUnicornSwitchCaseBreakPositionRequiresSoleNonEmptyBlockThenDirectTerminator owns these literal cases as a discoverable Go unit entry, retaining named subcase identities where present; actual engine/fix/command functions run in the shared process with isolated fixture files, without installation, native producer or product child host.
func TestUnicornSwitchCaseBreakPositionRequiresSoleNonEmptyBlockThenDirectTerminator(t *testing.T) {
  cases := []struct {
    name   string
    source string
  }{
    {
      name: "terminator already inside block",
      source: `switch (key) {
  case "first": {
    use(key);
    break;
  }
}
`,
    },
    {
      name: "unbraced clause",
      source: `switch (key) {
  case "first":
    use(key);
    break;
}
`,
    },
    {
      name: "empty block",
      source: `switch (key) {
  case "first": {}
  break;
}
`,
    },
    {
      name: "extra statement before terminator",
      source: `switch (key) {
  case "first": {
    use(key);
  }
  use(key);
  break;
}
`,
    },
    {
      name: "statement after terminator is dead code not this layout rule",
      source: `switch (key) {
  case "first": {
    use(key);
  }
  break;
  use(key);
}
`,
    },
    {
      name: "nested terminator is not direct",
      source: `switch (key) {
  case "first": {
    use(key);
  }
  if (key) break;
}
`,
    },
    {
      name: "labeled statement is not direct terminator",
      source: `switch (key) {
  case "first": {
    use(key);
  }
  local: break;
}
`,
    },
    {
      name: "fallthrough block",
      source: `switch (key) {
  case "first": {
    use(key);
  }
  case "second": {
    use(key);
    break;
  }
}
`,
    },
  }

  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleSkipsSource(t, switchCaseBreakPositionRule, "declare const key: string;\ndeclare function use(value: string): void;\n"+test.source)
    })
  }
}
