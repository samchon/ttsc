package linthost

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

const unicornTemplateIndentRuleName = "unicorn/template-indent"

func TestRuleCorpusUnicornTemplateIndent(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/template-indent.ts", `declare function sql(strings: TemplateStringsArray): string;

// expect: unicorn/template-indent error
const query = sql`+"`"+`
SELECT *
  FROM users
`+"`"+`;
`)
}

func TestUnicornTemplateIndentSelectsEveryOfficialEntryPointAtExactRange(t *testing.T) {
  source := "declare const value: unknown;\n" +
    "const tagged = gql`\none\n`;\n" +
    "const called = stripIndent(`\ntwo\n`);\n" +
    "const commented = /* html */ `\n<div>\n`;\n" +
    "expect(value).toMatchInlineSnapshot(`\nsnapshot\n`);\n"

  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  if len(findings) != 4 {
    t.Fatalf("want four findings, got %d (%+v)", len(findings), findings)
  }
  starts := []int{
    strings.Index(source, "`\none"),
    strings.Index(source, "`\ntwo"),
    strings.Index(source, "`\n<div>"),
    strings.Index(source, "`\nsnapshot"),
  }
  for index, finding := range findings {
    if finding.Rule != unicornTemplateIndentRuleName {
      t.Fatalf("finding %d rule: want %q, got %q", index, unicornTemplateIndentRuleName, finding.Rule)
    }
    if finding.Message != unicornTemplateIndentMessage {
      t.Fatalf("finding %d message: want %q, got %q", index, unicornTemplateIndentMessage, finding.Message)
    }
    if finding.Pos != starts[index] {
      t.Fatalf("finding %d start: want %d, got %d", index, starts[index], finding.Pos)
    }
    if finding.End <= finding.Pos || source[finding.End-1] != '`' {
      t.Fatalf("finding %d range does not cover the complete template: [%d,%d)", index, finding.Pos, finding.End)
    }
    if len(finding.Fix) == 0 {
      t.Fatalf("finding %d must carry raw-quasi edits", index)
    }
  }
}

func TestUnicornTemplateIndentPinsEveryDefaultMatcher(t *testing.T) {
  source := "const taggedOutdent = outdent`\ntag-outdent\n`;\n" +
    "const taggedDedent = dedent`\ntag-dedent\n`;\n" +
    "const taggedGraphQL = gql`\ntag-gql\n`;\n" +
    "const taggedSQL = sql`\ntag-sql\n`;\n" +
    "const taggedHTML = html`\ntag-html\n`;\n" +
    "const taggedStyled = styled`\ntag-styled\n`;\n" +
    "const calledDedent = dedent(`\nfunction-dedent\n`);\n" +
    "const calledStripIndent = stripIndent(`\nfunction-strip-indent\n`);\n" +
    "const commentedHTML = /* HTML */ `\ncomment-html\n`;\n" +
    "const commentedIndent = /* indent */ `\ncomment-indent\n`;\n"
  markers := []string{
    "`\ntag-outdent", "`\ntag-dedent", "`\ntag-gql", "`\ntag-sql", "`\ntag-html", "`\ntag-styled",
    "`\nfunction-dedent", "`\nfunction-strip-indent", "`\ncomment-html", "`\ncomment-indent",
  }

  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  if len(findings) != len(markers) {
    t.Fatalf("every default matcher must remain active: want %d findings, got %d (%+v)", len(markers), len(findings), findings)
  }
  for index, marker := range markers {
    want := strings.Index(source, marker)
    if want < 0 || findings[index].Pos != want {
      t.Fatalf("default matcher %q start: want %d, got %+v", marker, want, findings[index])
    }
  }
}

func TestUnicornTemplateIndentHonorsConfiguredTagsFunctionsCommentsAndSelectors(t *testing.T) {
  t.Run("name and comment lists replace defaults", func(t *testing.T) {
    source := "const tagged = utils.dedent`\none\n`;\n" +
      "const called = helpers.strip(`\ntwo\n`);\n" +
      "const commented = /* Please /* Indent */ `\nthree\n`;\n" +
      "const defaultTagIsReplaced = gql`\nfour\n`;\n" +
      "const computedTagIsNotAPath = utils[\"dedent\"]`\nfive\n`;\n" +
      "const callResultTagIsNotAPath = makeTag()`\nsix\n`;\n" +
      "const defaultFunctionIsReplaced = stripIndent(`\nseven\n`);\n" +
      "const defaultCommentIsReplaced = /* indent */ `\neight\n`;\n" +
      "const parenthesizedTag = (utils.dedent)`\nnine\n`;\n" +
      "const parenthesizedCall = (helpers.strip)((`\nten\n`));\n"
    options := json.RawMessage(`{
      "tags":["utils.dedent"],
      "functions":["helpers.strip"],
      "comments":["please /* indent"],
      "selectors":[]
    }`)
    _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, options)
    if len(findings) != 5 {
      t.Fatalf("want configured and parenthesized tag/function plus comment findings; got %d (%+v)", len(findings), findings)
    }
    for _, text := range []string{"`\none", "`\ntwo", "`\nthree", "`\nnine", "`\nten"} {
      start := strings.Index(source, text)
      found := false
      for _, finding := range findings {
        found = found || finding.Pos == start
      }
      if !found {
        t.Fatalf("missing configured match at %q", text)
      }
    }
  })

  t.Run("overlapping selectors report once", func(t *testing.T) {
    source := "const selected = `\none\n`;\n"
    options := json.RawMessage(`{
      "tags":[],
      "functions":[],
      "comments":[],
      "selectors":["TemplateLiteral","* > TemplateLiteral"]
    }`)
    _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, options)
    if len(findings) != 1 {
      t.Fatalf("overlapping selectors must report one finding, got %d (%+v)", len(findings), findings)
    }
  })
}

func TestUnicornTemplateIndentFixPreservesQuasisSubstitutionsEscapesAndBlankLines(t *testing.T) {
  source := "declare const value: string;\n" +
    "declare const other: string;\n" +
    "const query = gql`\n" +
    "        one ${value /* keep */}\n" +
    "          two \\n \\` literal ${other}\n" +
    "          three\n" +
    "        \n" +
    "        four\n" +
    "        `;\n"
  expected := "declare const value: string;\n" +
    "declare const other: string;\n" +
    "const query = gql`\n" +
    "  one ${value /* keep */}\n" +
    "    two \\n \\` literal ${other}\n" +
    "    three\n" +
    "\n" +
    "  four\n" +
    "`;\n"

  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
  }
  expressions := []string{"${value /* keep */}", "${other}"}
  if len(findings[0].Fix) != 3 {
    t.Fatalf("two-substitution template must expose three quasi edits, got %+v", findings[0].Fix)
  }
  for _, expression := range expressions {
    expressionStart := strings.Index(source, expression)
    if expressionStart < 0 {
      t.Fatalf("substitution oracle %q is missing", expression)
    }
    expressionEnd := expressionStart + len(expression)
    for _, edit := range findings[0].Fix {
      if edit.Pos < expressionEnd && edit.End > expressionStart {
        t.Fatalf("quasi edit [%d,%d) overlaps substitution %q at [%d,%d)", edit.Pos, edit.End, expression, expressionStart, expressionEnd)
      }
    }
  }

  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  file := parseTSFile(t, "/virtual/fixed-template.ts", expected)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, expected)
  }
  if !strings.Contains(expected, "${value /* keep */}") || !strings.Contains(expected, "${other}") ||
    !strings.Contains(expected, "\\n \\` literal") {
    t.Fatal("test oracle must retain substitution and raw escape spelling")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentFixesEmptyBoundaryQuasisWithInsertions(t *testing.T) {
  source := "declare const value: string;\n" +
    "declare const other: string;\n" +
    "const query = gql`${value}\none${other}`;\n"
  expected := "declare const value: string;\n" +
    "declare const other: string;\n" +
    "const query = gql`\n  ${value}\n  one${other}\n`;\n"

  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  if len(findings) != 1 || len(findings[0].Fix) != 3 {
    t.Fatalf("empty boundary quasis must produce three edits, got %+v", findings)
  }
  if findings[0].Fix[0].Pos != findings[0].Fix[0].End ||
    findings[0].Fix[2].Pos != findings[0].Fix[2].End {
    t.Fatalf("boundary quasi edits must be zero-width insertions, got %+v", findings[0].Fix)
  }
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentFixesNestedTemplatesWithoutTouchingExpressions(t *testing.T) {
  source := "declare const ready: boolean;\n" +
    "declare const value: string;\n" +
    "declare function use(): void;\n" +
    "if (ready) {\n  use();\n}\n" +
    "const outer = outdent`\n" +
    "  before\n" +
    "  before${\n" +
    "\t\t\toutdent`\n" +
    "inner ${value}\n" +
    "\t\t\t`\n" +
    "}after\n" +
    "  after\n" +
    "`;\n"
  expected := "declare const ready: boolean;\n" +
    "declare const value: string;\n" +
    "declare function use(): void;\n" +
    "if (ready) {\n  use();\n}\n" +
    "const outer = outdent`\n" +
    "  before\n" +
    "  before${\n" +
    "\t\t\toutdent`\n" +
    "\t\t\t\tinner ${value}\n" +
    "\t\t\t`\n" +
    "}after\n" +
    "  after\n" +
    "`;\n"

  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  file := parseTSFile(t, "/virtual/fixed-nested-template.ts", expected)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixed nested source has parse diagnostics: %+v\n%s", diagnostics, expected)
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentDetectsTabsOutsideTemplates(t *testing.T) {
  source := "if (ready) {\n\tuse();\n}\n\n" +
    "const query = html`\n" +
    "item\n" +
    "  child\n" +
    "`;\n"
  expected := "if (ready) {\n\tuse();\n}\n\n" +
    "const query = html`\n" +
    "\titem\n" +
    "\t  child\n" +
    "`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentPreservesCRLF(t *testing.T) {
  source := "if (ready) {\r\n  use();\r\n}\r\n" +
    "const query = gql`\r\n" +
    "one\r\n" +
    "  child\r\n" +
    "`;\r\n"
  expected := "if (ready) {\r\n  use();\r\n}\r\n" +
    "const query = gql`\r\n" +
    "  one\r\n" +
    "    child\r\n" +
    "`;\r\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  if strings.ReplaceAll(expected, "\r\n", "") == expected {
    t.Fatal("CRLF oracle must contain CRLF line endings")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentPreservesLeadingByteOrderMark(t *testing.T) {
  source := "\uFEFFconst query = gql`\none\n`;\n"
  expected := "\uFEFFconst query = gql`\n  one\n`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  if strings.Count(expected, "\uFEFF") != 1 || !strings.HasPrefix(expected, "\uFEFF") {
    t.Fatal("the fixed source must preserve exactly one leading byte-order mark")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentPreservesMixedInteriorLineEndings(t *testing.T) {
  source := "if (ready) {\r\n  use();\n}\r\n" +
    "const query = gql`\r\n" +
    "one\n" +
    "  child\r\n" +
    "`;\r\n"
  expected := "if (ready) {\r\n  use();\n}\r\n" +
    "const query = gql`\r\n" +
    "  one\n" +
    "    child\r\n" +
    "`;\r\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  if !strings.Contains(expected, "  one\n    child\r\n") {
    t.Fatal("mixed-EOL oracle must retain the interior LF and boundary CRLF")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentPreservesEveryInteriorECMAScriptLineEnding(t *testing.T) {
  source := "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n" +
    "one\r" +
    "  child\u2028" +
    "    grandchild\u2029" +
    "      last\n" +
    "`;\n"
  expected := "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n" +
    "  one\r" +
    "    child\u2028" +
    "      grandchild\u2029" +
    "        last\n" +
    "`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  if !strings.Contains(expected, "one\r    child\u2028      grandchild\u2029        last") {
    t.Fatal("mixed ECMAScript line-ending oracle must retain every interior separator")
  }
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentRecognizesEveryECMAScriptSourceLineSeparator(t *testing.T) {
  separators := []struct {
    name string
    text string
  }{
    {name: "carriage-return", text: "\r"},
    {name: "line-separator", text: "\u2028"},
    {name: "paragraph-separator", text: "\u2029"},
  }
  for _, separator := range separators {
    t.Run(separator.name+"-source-indent", func(t *testing.T) {
      source := "if (ready) {" + separator.text + "\tuse();" + separator.text + "}" + separator.text +
        "const query = gql`\none\n`;\n"
      expected := "if (ready) {" + separator.text + "\tuse();" + separator.text + "}" + separator.text +
        "const query = gql`\n\tone\n`;\n"
      assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
      assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
    })

    t.Run(separator.name+"-parent-margin", func(t *testing.T) {
      source := "if (ready) {" + separator.text +
        "  const query = gql`\none\n`;" + separator.text +
        "}" + separator.text
      expected := "if (ready) {" + separator.text +
        "  const query = gql`\n    one\n  `;" + separator.text +
        "}" + separator.text
      assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
      assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
    })
  }
}

func TestUnicornTemplateIndentFallsBackToTwoSpacesWithoutAnyIndentSignal(t *testing.T) {
  source := "const query = gql`\none\ntwo\n`;\n"
  expected := "const query = gql`\n  one\n  two\n`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentPreservesContentTrailingSpaces(t *testing.T) {
  source := "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n" +
    "one    \n" +
    "  child  \n" +
    "`;\n"
  expected := "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n" +
    "  one    \n" +
    "    child  \n" +
    "`;\n"
  assertFixSnapshot(t, unicornTemplateIndentRuleName, source, expected)
  assertRuleSkipsSource(t, unicornTemplateIndentRuleName, expected)
}

func TestUnicornTemplateIndentHonorsNumericAndWhitespaceIndentOptions(t *testing.T) {
  cases := []struct {
    name     string
    options  string
    expected string
  }{
    {
      name:    "numeric spaces",
      options: `{"indent":4}`,
      expected: "const query = gql`\n" +
        "    one\n" +
        "      child\n" +
        "`;\n",
    },
    {
      name:    "literal tab",
      options: `{"indent":"\t"}`,
      expected: "const query = gql`\n" +
        "\tone\n" +
        "\t  child\n" +
        "`;\n",
    },
  }
  source := "const query = gql`\n" +
    "one\n" +
    "  child\n" +
    "`;\n"
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, unicornTemplateIndentRuleName, source, test.options, test.expected)
      assertRuleSkipsSourceWithOptions(t, unicornTemplateIndentRuleName, test.expected, test.options)
    })
  }
}

func TestUnicornTemplateIndentSkipsUnselectedSingleLineAndAlreadyCorrectTemplates(t *testing.T) {
  sources := []string{
    "const single = gql`one`;\n",
    "const unselected = other`\n        one\n        `;\n",
    "const computed = utils[\"dedent\"]`\n        one\n        `;\n",
    "const calledTag = makeTag()`\n        one\n        `;\n",
    "const lineComment = // indent\n`\n        one\n        `;\n",
    "const closerBlockCommentWins = /* indent */ /* other */ `\n        one\n        `;\n",
    "const closerLineCommentWins = /* indent */ // other\n`\n        one\n        `;\n",
    "const commentBeforeTagIsNotBeforeTemplate = /* indent */ other`\n        one\n        `;\n",
    "const nestedFunctionArgument = stripIndent([`\n        one\n        `]);\n",
    "if (ready) {\n  use();\n}\nconst correct = gql`\n  one\n    child\n`;\n",
    "const existingTemplateIndent = gql`\n        one\n        two\n`;\n",
  }
  for index, source := range sources {
    t.Run(unicornTemplateIndentSkipTestName(index), func(t *testing.T) {
      assertRuleSkipsSource(t, unicornTemplateIndentRuleName, source)
    })
  }
}

func TestUnicornTemplateIndentRejectsMalformedOptionsBeforeLinting(t *testing.T) {
  cases := []struct {
    name    string
    options string
    want    string
  }{
    {name: "not object", options: `[]`, want: "must be an object"},
    {name: "unknown key", options: `{"tagz":[]}`, want: "contain only indent"},
    {name: "empty indent", options: `{"indent":""}`, want: "must not be empty"},
    {name: "non whitespace indent", options: `{"indent":" x"}`, want: "only whitespace"},
    {name: "non ECMAScript whitespace indent", options: `{"indent":"\u0085"}`, want: "only whitespace"},
    {name: "zero indent", options: `{"indent":0}`, want: "positive integer"},
    {name: "fraction indent", options: `{"indent":1.5}`, want: "positive integer"},
    {name: "null tags", options: `{"tags":null}`, want: "array of unique strings"},
    {name: "non string tag", options: `{"tags":[1]}`, want: "array of unique strings"},
    {name: "duplicate function", options: `{"functions":["dedent","dedent"]}`, want: "must not contain duplicate"},
    {name: "invalid selector", options: `{"selectors":["["]}`, want: "selector 1"},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules: RuleConfig{unicornTemplateIndentRuleName: SeverityError},
        Options: RuleOptionsMap{
          unicornTemplateIndentRuleName: json.RawMessage(test.options),
        },
      })
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), test.want) {
        t.Fatalf("ConfigError: want substring %q, got %v", test.want, err)
      }
    })
  }
}

func TestCommandFixUnicornTemplateIndentConvergesAndIsIdempotent(t *testing.T) {
  source := "declare const ready: boolean;\n" +
    "declare function use(): void;\n" +
    "declare function gql(strings: TemplateStringsArray): string;\n" +
    "if (ready) {\n  use();\n}\n" +
    "const query = gql`\none\n  child\n`;\n"
  expected := "declare const ready: boolean;\n" +
    "declare function use(): void;\n" +
    "declare function gql(strings: TemplateStringsArray): string;\n" +
    "if (ready) {\n  use();\n}\n" +
    "const query = gql`\n  one\n    child\n`;\n"
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{unicornTemplateIndentRuleName: "error"})
  args := []string{"fix", "--cwd", root, "--plugins-json", lintManifest(t)}
  for pass := 1; pass <= 2; pass++ {
    code, stdout, stderr := captureCommandOutput(t, func() int { return run(args) })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("fix pass %d mismatch: code=%d stdout=%q stderr=%q", pass, code, stdout, stderr)
    }
    assertFileText(t, filepath.Join(root, "src", "main.ts"), expected)
  }
}

func unicornTemplateIndentSkipTestName(index int) string {
  names := []string{
    "single-line",
    "unselected-tag",
    "computed-tag",
    "call-result-tag",
    "line-comment",
    "closer-block-comment",
    "closer-line-comment",
    "comment-before-tag",
    "non-direct-function-argument",
    "already-correct",
    "existing-template-indent-fallback",
  }
  return names[index]
}

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

func TestUnicornTemplateIndentAcceptsParenthesizedJestInlineSnapshot(t *testing.T) {
  source := "declare const value: unknown;\n" +
    "(expect)(value).toMatchInlineSnapshot((`\nsnapshot\n`));\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("parenthesized Jest inline snapshot must be selected, got %+v", findings)
  }
}
