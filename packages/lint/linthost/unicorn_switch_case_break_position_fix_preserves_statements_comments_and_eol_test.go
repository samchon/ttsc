package linthost

import (
  "testing"
)

// TestUnicornSwitchCaseBreakPositionFixPreservesStatementsCommentsAndEOL verifies safe terminator moves preserve source details.
//
// The literal expected sources preserve labeled statements, comments, indentation and line endings under the supported move policy; they are not produced by Go.
//
// 1. Execute the retained clause or command fixture through the owning Go operation.
// 2. Compare the authored report, edit or preserved-file result for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer compares each named transformation with full authored output and retains its clean re-lint and parsing checks.
// @evidence contracts/testing.md#independent-expectations The literal expected sources preserve labeled statements, comments, indentation and line endings under the supported move policy; they are not produced by Go.
// @evidence contracts/testing.md#distinguishing-cases Named label/default/continue/comment/nested-control-flow/CRLF scenarios and the later-line-comment boundary retain their distinct outputs.
// @evidence contracts/testing.md#execution-ownership TestUnicornSwitchCaseBreakPositionFixPreservesStatementsCommentsAndEOL owns these literal cases as a discoverable Go unit entry, retaining named subcase identities where present; actual engine/fix/command functions run in the shared process with isolated fixture files, without installation, native producer or product child host.
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
