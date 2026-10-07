package linthost

import (
  "strings"
  "testing"
)

// TestUnicornSwitchCaseBreakPositionReportsEverySupportedTerminatorAtExactRange verifies all supported direct terminators retain exact diagnostics.
//
// The supported four-statement policy independently requires a report; return/throw expressions may bind differently after movement and remain diagnostic-only.
//
// 1. Execute the authored terminator clauses through the actual parser and engine snapshot.
// 2. Compare the authored report, edit or preserved-file result for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The real engine checks break, continue, return and throw findings against authored ranges/messages and expected edit availability.
// @evidence contracts/testing.md#independent-expectations The supported four-statement policy independently requires a report; return/throw expressions may bind differently after movement and remain diagnostic-only.
// @evidence contracts/testing.md#distinguishing-cases Each supported terminator and retained label/clause shape keeps its exact range and fix expectation.
// @evidence contracts/testing.md#execution-ownership TestUnicornSwitchCaseBreakPositionReportsEverySupportedTerminatorAtExactRange owns these literal cases as a discoverable Go unit entry, retaining named subcase identities where present; actual parser and engine functions run in the shared process with isolated fixture files. Finding edit availability is inspected without applying fixes, installation, native producer or command/product child host.
func TestUnicornSwitchCaseBreakPositionReportsEverySupportedTerminatorAtExactRange(t *testing.T) {
  cases := []struct {
    name      string
    source    string
    statement string
    keyword   string
    fixable   bool
  }{
    {
      name: "break in case",
      source: `declare const key: string;
switch (key) {
  case "first": {
    void key;
  }
  break;
}
`,
      statement: "break;",
      keyword:   "break",
      fixable:   true,
    },
    {
      name: "labeled break in default",
      source: `outer: for (const key of ["first"]) {
  switch (key) {
    default: {
      void key;
    }
    break outer;
  }
}
`,
      statement: "break outer;",
      keyword:   "break",
      fixable:   true,
    },
    {
      name: "continue in loop",
      source: `for (const key of ["first"]) {
  switch (key) {
    case "first": {
      void key;
    }
    continue;
  }
}
`,
      statement: "continue;",
      keyword:   "continue",
      fixable:   true,
    },
    {
      name: "return with expression",
      source: `function choose(key: string): string {
  switch (key) {
    case "first": {
      void key;
    }
    return key;
  }
}
`,
      statement: "return key;",
      keyword:   "return",
      fixable:   false,
    },
    {
      name: "throw with expression",
      source: `declare const key: string;
switch (key) {
  case "first": {
    void key;
  }
  throw new Error(key);
}
`,
      statement: "throw new Error(key);",
      keyword:   "throw",
      fixable:   false,
    },
  }

  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, switchCaseBreakPositionRule, test.source, nil)
      assertUnicornRuleErrorFindingIdentities(t, switchCaseBreakPositionRule, findings)
      if len(findings) != 1 {
        t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
      }
      finding := findings[0]
      start := strings.Index(test.source, test.statement)
      if start < 0 || strings.LastIndex(test.source, test.statement) != start {
        t.Fatalf("statement %q must occur exactly once", test.statement)
      }
      if finding.Rule != switchCaseBreakPositionRule {
        t.Fatalf("rule: want %q, got %q", switchCaseBreakPositionRule, finding.Rule)
      }
      if finding.Pos != start || finding.End != start+len(test.statement) {
        t.Fatalf("range: want [%d,%d), got [%d,%d)", start, start+len(test.statement), finding.Pos, finding.End)
      }
      wantMessage := "Move `" + test.keyword + "` inside the block statement."
      if finding.Message != wantMessage {
        t.Fatalf("message: want %q, got %q", wantMessage, finding.Message)
      }
      if test.fixable && len(finding.Fix) != 2 {
        t.Fatalf("want two move edits, got %+v", finding.Fix)
      }
      if !test.fixable && len(finding.Fix) != 0 {
        t.Fatalf("want diagnostic-only finding, got edits %+v", finding.Fix)
      }
    })
  }
}
