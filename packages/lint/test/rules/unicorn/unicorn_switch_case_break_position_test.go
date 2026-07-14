package linthost

import (
  "strings"
  "testing"
)

const switchCaseBreakPositionRule = "unicorn/switch-case-break-position"

// TestRuleCorpusUnicornSwitchCaseBreakPosition keeps the public TypeScript
// corpus fixture connected to a real behavioral witness. The diagnostic is on
// the direct break after the clause's sole non-empty block.
func TestRuleCorpusUnicornSwitchCaseBreakPosition(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/switch-case-break-position.ts", `declare const key: string;
switch (key) {
  case "first": {
    void key;
  }
  // expect: unicorn/switch-case-break-position error
  break;
}
`)
}

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

func TestUnicornSwitchCaseBreakPositionFixPreservesStatementsCommentsAndEOL(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name: "basic case break",
      source: `declare const key: string;
switch (key) {
  case "first": {
    void key;
  }
  break;
}
`,
      expected: `declare const key: string;
switch (key) {
  case "first": {
    void key;
    break;
  }
}
`,
    },
    {
      name: "labeled default break without semicolon",
      source: `outer: for (const key of ["first"]) {
  switch (key) {
    default: {
      void key
    }
    break outer
  }
}
`,
      expected: `outer: for (const key of ["first"]) {
  switch (key) {
    default: {
      void key
      break outer
    }
  }
}
`,
    },
    {
      name: "labeled continue",
      source: `outer: for (const key of ["first"]) {
  switch (key) {
    case "first": {
      void key;
    }
    continue outer;
  }
}
`,
      expected: `outer: for (const key of ["first"]) {
  switch (key) {
    case "first": {
      void key;
      continue outer;
    }
  }
}
`,
    },
    {
      name: "body comments and blank lines",
      source: `declare const key: string;
switch (key) {
  case "first": {
    void key; // keep inline

    // keep before terminator
  }


  break;
}
`,
      expected: `declare const key: string;
switch (key) {
  case "first": {
    void key; // keep inline

    // keep before terminator
    break;
  }
}
`,
    },
    {
      name: "nested control flow and block comment",
      source: `declare const key: string;
declare function use(value: string): void;
switch (key) {
  case "first": {
    if (key) {
      use(key);
    } else {
      use("fallback");
    }
    /* keep after nested statement */
  }
  break;
}
`,
      expected: `declare const key: string;
declare function use(value: string): void;
switch (key) {
  case "first": {
    if (key) {
      use(key);
    } else {
      use("fallback");
    }
    /* keep after nested statement */
    break;
  }
}
`,
    },
    {
      name:     "CRLF",
      source:   "declare const key: string;\r\nswitch (key) {\r\n  default: {\r\n    void key;\r\n  }\r\n  break;\r\n}\r\n",
      expected: "declare const key: string;\r\nswitch (key) {\r\n  default: {\r\n    void key;\r\n    break;\r\n  }\r\n}\r\n",
    },
    {
      name: "comment on later line remains between clauses",
      source: `declare const key: string;
switch (key) {
  case "first": {
    void key;
  }
  break;
  // second case documentation
  case "second": {
    void key;
    break;
  }
}
`,
      expected: `declare const key: string;
switch (key) {
  case "first": {
    void key;
    break;
  }
  // second case documentation
  case "second": {
    void key;
    break;
  }
}
`,
    },
  }

  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshot(t, switchCaseBreakPositionRule, test.source, test.expected)
      file := parseTSFile(t, "/virtual/fixed-switch.ts", test.expected)
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, test.expected)
      }
      assertRuleSkipsSource(t, switchCaseBreakPositionRule, test.expected)
    })
  }
}

func TestUnicornSwitchCaseBreakPositionDeclinesUnsafeOrSemanticMoves(t *testing.T) {
  cases := []struct {
    name   string
    source string
  }{
    {
      name: "comment between block and break",
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
      source: `switch (key) {
  case "first": { use(key); }
  break;
}
`,
    },
    {
      name: "return may change block binding",
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
      assertNoFixSnapshot(t, switchCaseBreakPositionRule, source)
    })
  }
}
