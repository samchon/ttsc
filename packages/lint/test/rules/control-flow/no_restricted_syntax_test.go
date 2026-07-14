package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

type noRestrictedSyntaxExpectation struct {
  target  string
  message string
}

func runNoRestrictedSyntax(
  t *testing.T,
  source string,
  options json.RawMessage,
  expected ...noRestrictedSyntaxExpectation,
) {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "no-restricted-syntax", source, options)
  if len(findings) != len(expected) {
    t.Fatalf("no-restricted-syntax finding count mismatch: want=%+v got=%+v", expected, findings)
  }
  searchFrom := 0
  for index, want := range expected {
    relative := strings.Index(source[searchFrom:], want.target)
    if relative < 0 {
      t.Fatalf("expectation %d target %q is absent after byte %d", index, want.target, searchFrom)
    }
    start := searchFrom + relative
    end := start + len(want.target)
    finding := findings[index]
    if finding.Rule != "no-restricted-syntax" || finding.Severity != SeverityError ||
      finding.Pos != start || finding.End != end || finding.Message != want.message {
      t.Fatalf("finding %d mismatch: want=%+v range=[%d,%d) got=%+v", index, want, start, end, finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d unexpectedly offered edits: %+v", index, finding)
    }
    searchFrom = end
  }
}

func noRestrictedDefaultMessage(selector string) string {
  return "Using '" + selector + "' is not allowed."
}

func TestNoRestrictedSyntaxHasNoImplicitDenylist(t *testing.T) {
  source := `function legacy(target: any): void {
  with (target) { target.value = 1; }
  outer: for (;;) { break outer; }
}
`
  runNoRestrictedSyntax(t, source, nil)
  runNoRestrictedSyntax(t, source, json.RawMessage(`[]`))
}

func TestNoRestrictedSyntaxAppliesEveryConfiguredEntryAndCustomMessage(t *testing.T) {
  source := `function legacy(target: any): void {
  with (target) { target.value = 1; }
  outer: for (;;) { break outer; }
}
`
  options := json.RawMessage(`[
    "WithStatement",
    {"selector":"LabeledStatement","message":"Labels obscure control flow."}
  ]`)
  runNoRestrictedSyntax(
    t,
    source,
    options,
    noRestrictedSyntaxExpectation{
      target:  `with (target) { target.value = 1; }`,
      message: noRestrictedDefaultMessage("WithStatement"),
    },
    noRestrictedSyntaxExpectation{
      target:  `outer: for (;;) { break outer; }`,
      message: "Labels obscure control flow.",
    },
  )
}

func TestNoRestrictedSyntaxMatchesAttributesNestedPathsRegexTypesAndLengths(t *testing.T) {
  source := `declare function DANGER(first: number, second: number): void;
const target = { key: true };
const present = "key" in target;
DANGER(1, 2);
JSON.stringify(present);
`
  selector := `CallExpression[callee.name=/^danger$/iu][callee.name=type(string)][arguments.length>=2]`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`{"selector":"`+selector+`","message":"Dangerous call."}`),
    noRestrictedSyntaxExpectation{target: "DANGER(1, 2)", message: "Dangerous call."},
  )

  binarySelector := `BinaryExpression[operator='in']`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+binarySelector+`"`),
    noRestrictedSyntaxExpectation{target: `"key" in target`, message: noRestrictedDefaultMessage(binarySelector)},
  )
}

func TestNoRestrictedSyntaxMatchesCombinatorsFieldsPseudosAndSubjects(t *testing.T) {
  functionSource := `function selected(value: number): number {
  return value;
}
`
  fieldSelector := `FunctionDeclaration > Identifier.id`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+fieldSelector+`"`),
    noRestrictedSyntaxExpectation{target: "selected", message: noRestrictedDefaultMessage(fieldSelector)},
  )

  descendantSelector := `FunctionDeclaration ReturnStatement > Identifier.expression`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+descendantSelector+`"`),
    noRestrictedSyntaxExpectation{target: "value", message: noRestrictedDefaultMessage(descendantSelector)},
  )

  hasSelector := `FunctionDeclaration:has(> Identifier.id):not([async=true])`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+hasSelector+`"`),
    noRestrictedSyntaxExpectation{target: strings.TrimSpace(functionSource), message: noRestrictedDefaultMessage(hasSelector)},
  )

  subjectSelector := `!FunctionDeclaration > Identifier.id`
  runNoRestrictedSyntax(
    t,
    functionSource,
    json.RawMessage(`"`+subjectSelector+`"`),
    noRestrictedSyntaxExpectation{target: strings.TrimSpace(functionSource), message: noRestrictedDefaultMessage(subjectSelector)},
  )

  siblingSource := `const first = 1, second = 2, third = 3;
JSON.stringify([first, second, third]);
`
  adjacentSelector := `VariableDeclaration + VariableDeclaration[name='second']:nth-child(2)`
  runNoRestrictedSyntax(
    t,
    siblingSource,
    json.RawMessage(`"`+adjacentSelector+`"`),
    noRestrictedSyntaxExpectation{target: "second = 2", message: noRestrictedDefaultMessage(adjacentSelector)},
  )
  siblingSelector := `VariableDeclaration ~ VariableDeclaration[name='third']:last-child`
  runNoRestrictedSyntax(
    t,
    siblingSource,
    json.RawMessage(`"`+siblingSelector+`"`),
    noRestrictedSyntaxExpectation{target: "third = 3", message: noRestrictedDefaultMessage(siblingSelector)},
  )
}

func TestNoRestrictedSyntaxMatchesClassesAlternativesAndTypeScriptNodes(t *testing.T) {
  source := `type Text = string;
declare const input: unknown;
const asserted = input as Text;
const satisfied = input satisfies unknown;
function returns(): unknown { return asserted; }
JSON.stringify([satisfied, returns]);
`
  selector := `:matches(TSAsExpression, TSSatisfiesExpression)`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+selector+`"`),
    noRestrictedSyntaxExpectation{target: "input as Text", message: noRestrictedDefaultMessage(selector)},
    noRestrictedSyntaxExpectation{target: "input satisfies unknown", message: noRestrictedDefaultMessage(selector)},
  )

  classSelector := `:function:has(ReturnStatement)`
  runNoRestrictedSyntax(
    t,
    source,
    json.RawMessage(`"`+classSelector+`"`),
    noRestrictedSyntaxExpectation{target: "function returns(): unknown { return asserted; }", message: noRestrictedDefaultMessage(classSelector)},
  )
}

func noRestrictedSyntaxValidationEngine(options json.RawMessage) *Engine {
  return NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"no-restricted-syntax": SeverityError},
    Options: RuleOptionsMap{
      "no-restricted-syntax": options,
    },
  })
}

func TestNoRestrictedSyntaxRejectsInvalidConfigurationBeforeDispatch(t *testing.T) {
  cases := []struct {
    name    string
    options json.RawMessage
    want    string
  }{
    {name: "malformed JSON", options: json.RawMessage(`{"selector":`), want: "must contain only selector and message"},
    {name: "wrong entry type", options: json.RawMessage(`42`), want: "must be a selector string or {selector,message} object"},
    {name: "missing selector", options: json.RawMessage(`{"message":"missing"}`), want: "is missing selector"},
    {name: "unknown key", options: json.RawMessage(`{"selector":"Identifier","extra":true}`), want: "unknown field"},
    {name: "empty selector", options: json.RawMessage(`"  "`), want: "selector must not be empty"},
    {name: "duplicate", options: json.RawMessage(`["Identifier","Identifier"]`), want: "duplicates an earlier option"},
    {name: "unterminated attribute", options: json.RawMessage(`"Identifier[name='x'"`), want: "expected ']'"},
    {name: "invalid regexp", options: json.RawMessage(`"Identifier[name=/(/]"`), want: "invalid regular expression"},
    {name: "unknown class", options: json.RawMessage(`":mystery"`), want: "unknown AST class"},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      engine := noRestrictedSyntaxValidationEngine(tc.options)
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), tc.want) {
        t.Fatalf("invalid no-restricted-syntax config mismatch: want=%q got=%v", tc.want, err)
      }
      if _, active := engine.EnabledRules()["no-restricted-syntax"]; active {
        t.Fatalf("invalid rule entered dispatch: %v", engine.EnabledRules())
      }
    })
  }
}

func TestCommandCheckHonorsNoRestrictedSyntaxOptions(t *testing.T) {
  root := seedLintProject(t, `eval("1");
const safe = JSON.stringify(1);
void safe;
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-syntax": []any{
        "error",
        map[string]any{
          "selector": "CallExpression[callee.name='eval']",
          "message":  "Do not evaluate source text.",
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[no-restricted-syntax] Do not evaluate source text.") != 1 {
    t.Fatalf("valid command path mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}

func TestCommandCheckRejectsInvalidNoRestrictedSyntaxSelector(t *testing.T) {
  root := seedLintProject(t, `eval("1");
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-syntax": []any{"error", "CallExpression["},
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, `invalid options for rule "no-restricted-syntax"`) ||
    !strings.Contains(stderr, "invalid selector") || strings.Contains(stderr, "[no-restricted-syntax]") {
    t.Fatalf("invalid command path mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
