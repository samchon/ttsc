package linthost

import (
  "testing"
)

// TestUnicornSwitchCaseBreakPositionDeclinesUnsafeOrSemanticMoves verifies unsafe terminator moves retain diagnostics without edits.
//
// The supported safety policy independently forbids moving comment-bound or single-line statements and return/throw binding-sensitive expressions; the diagnostic remains required.
//
// 1. Execute the retained clause or command fixture through the owning Go operation.
// 2. Compare the authored report, edit or preserved-file result for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The real engine must produce one ordinary rule error with exact terminator message and no fix for each named unsafe case, while the original fix pipeline must leave source unchanged.
// @evidence contracts/testing.md#independent-expectations The supported safety policy independently forbids moving comment-bound or single-line statements and return/throw binding-sensitive expressions; the diagnostic remains required.
// @evidence contracts/testing.md#distinguishing-cases The six named cases preserve intervening comment, trailing line/block comment, single-line block and return/throw binding distinctions; safe-edit hosts own allowed moves.
// @evidence contracts/testing.md#execution-ownership TestUnicornSwitchCaseBreakPositionDeclinesUnsafeOrSemanticMoves owns these literal cases as a discoverable Go unit entry, retaining named subcase identities where present; actual engine/fix/command functions run in the shared process with isolated fixture files, without installation, native producer or product child host.
func TestUnicornSwitchCaseBreakPositionDeclinesUnsafeOrSemanticMoves(t *testing.T) {
  cases := []struct {
    name   string
    source string
    keyword string
  }{
    {
      name: "comment between block and break",
      keyword: "break",
      source: `switch (key) {
  case "first": {
    use(key);
  }
  // keep with break
  break;
}
`,
    },
    {
      name: "trailing line comment on break",
      keyword: "break",
      source: `switch (key) {
  case "first": {
    use(key);
  }
  break; // keep with break
}
`,
    },
    {
      name: "trailing block comment on continue",
      keyword: "continue",
      source: `for (const key of ["first"]) {
  switch (key) {
    case "first": {
      use(key);
    }
    continue; /* keep with continue */
  }
}
`,
    },
    {
      name: "single-line block",
      keyword: "break",
      source: `switch (key) {
  case "first": { use(key); }
  break;
}
`,
    },
    {
      name: "return may change block binding",
      keyword: "return",
      source: `function choose(key: string): string {
  switch (key) {
    case "first": {
      const value = key;
    }
    return value;
  }
}
`,
    },
    {
      name: "throw may change block binding",
      keyword: "throw",
      source: `switch (key) {
  case "first": {
    const error = new Error(key);
  }
  throw error;
}
`,
    },
  }

  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      source := "declare const key: string;\ndeclare function use(value: string): void;\n" + test.source
      _, _, findings := runRuleFindingsSnapshot(t, switchCaseBreakPositionRule, source, nil)
      assertUnicornRuleErrorFindingIdentities(t, switchCaseBreakPositionRule, findings)
      if len(findings) != 1 {
        t.Fatalf("unsafe move must retain one diagnostic, got %+v", findings)
      }
      finding := findings[0]
      if finding.engineFailure || finding.Severity != SeverityError || finding.Rule != switchCaseBreakPositionRule ||
        finding.Message != "Move `" + test.keyword + "` inside the block statement." || len(finding.Fix) != 0 {
        t.Fatalf("unsafe move must report the terminator without an automatic edit, got %+v", finding)
      }
      assertNoFixSnapshot(t, switchCaseBreakPositionRule, source)
    })
  }
}
