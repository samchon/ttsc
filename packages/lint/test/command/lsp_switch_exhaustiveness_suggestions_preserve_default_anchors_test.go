package linthost

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"
)

// TestLSPSwitchExhaustivenessSuggestionsPreserveDefaultAnchors verifies
// missing-case edits remain opt-in and are inserted before both kinds of
// recognized defaults.
//
//  1. Offer a unique-symbol case before a real default, but never through
//     source.fixAll.ttsc.
//  2. Offer a namespace-qualified enum case before an inline comment default.
//  3. Fill an empty switch using safe bracket syntax for a quoted enum member.
//  4. Add a required default after the last real clause of an open switch.
//  5. Execute each command-backed suggestion and re-check the resulting source
//     through the real lint command to prove it is valid and exhaustive.
func TestLSPSwitchExhaustivenessSuggestionsPreserveDefaultAnchors(t *testing.T) {
  uniqueSource := `declare const first: unique symbol;
declare const second: unique symbol;
declare const value: typeof first | typeof second;
switch (value) {
  case first:
    break;
  default:
    break;
}
`
  uniqueRoot := seedLintProject(t, uniqueSource)
  seedLintRules(t, uniqueRoot, map[string]string{switchExhaustivenessCheckRuleName: "error"})
  uniqueURI := lintTestFileURI(t, filepath.Join(uniqueRoot, "src", "main.ts"))
  uniqueAction := switchExhaustivenessSuggestionActionForTest(t, uniqueRoot, uniqueURI, 3)
  fixed := applySwitchExhaustivenessSuggestionForTest(
    t,
    uniqueRoot,
    uniqueURI,
    uniqueSource,
    uniqueAction,
  )
  caseIndex := strings.Index(fixed, "case second:")
  defaultIndex := strings.Index(fixed, "default:")
  if caseIndex < 0 || defaultIndex < 0 || caseIndex >= defaultIndex {
    t.Fatalf("unique-symbol suggestion did not precede the real default:\n%s", fixed)
  }
  fixAll := runLSPCodeActionsForRangeForTest(
    t,
    uniqueRoot,
    uniqueURI,
    `{"start":{"line":3,"character":0},"end":{"line":4,"character":0}}`,
    `{"only":["source.fixAll.ttsc"]}`,
  )
  if len(fixAll) != 0 {
    t.Fatalf("suggestion-only finding leaked into source.fixAll.ttsc: %#v", fixAll)
  }
  assertSwitchExhaustivenessSuggestedSourceForTest(t, uniqueRoot, fixed)

  enumSource := `namespace Domain {
  export enum Mode { Ready, Done }
}
declare const value: Domain.Mode;
switch (value) {
  case Domain.Mode.Ready:
    break // no default
}
`
  enumRoot := seedLintProject(t, enumSource)
  seedLintRules(t, enumRoot, map[string]string{switchExhaustivenessCheckRuleName: "error"})
  enumURI := lintTestFileURI(t, filepath.Join(enumRoot, "src", "main.ts"))
  enumAction := switchExhaustivenessSuggestionActionForTest(t, enumRoot, enumURI, 4)
  fixed = applySwitchExhaustivenessSuggestionForTest(
    t,
    enumRoot,
    enumURI,
    enumSource,
    enumAction,
  )
  caseIndex = strings.Index(fixed, "case Domain.Mode.Done:")
  commentIndex := strings.Index(fixed, "// no default")
  if caseIndex < 0 || commentIndex < 0 || caseIndex >= commentIndex {
    t.Fatalf("enum suggestion did not precede the comment default:\n%s", fixed)
  }
  assertSwitchExhaustivenessSuggestedSourceForTest(t, enumRoot, fixed)

  quotedSource := `enum Weird { "test-test" = "test-test", plain = "plain" }
declare const value: Weird;
switch (value) {}
`
  quotedRoot := seedLintProject(t, quotedSource)
  seedLintRules(t, quotedRoot, map[string]string{switchExhaustivenessCheckRuleName: "error"})
  quotedURI := lintTestFileURI(t, filepath.Join(quotedRoot, "src", "main.ts"))
  quotedAction := switchExhaustivenessSuggestionActionForTest(t, quotedRoot, quotedURI, 2)
  fixed = applySwitchExhaustivenessSuggestionForTest(
    t,
    quotedRoot,
    quotedURI,
    quotedSource,
    quotedAction,
  )
  hasQuotedCase := strings.Contains(fixed, `case Weird["test-test"]:`) ||
    strings.Contains(fixed, `case Weird['test-test']:`)
  if !hasQuotedCase || !strings.Contains(fixed, "case Weird.plain:") {
    t.Fatalf("empty-switch suggestion emitted unsafe enum cases:\n%s", fixed)
  }
  assertSwitchExhaustivenessSuggestedSourceForTest(t, quotedRoot, fixed)

  openSource := `declare const value: string;
switch (value) {
  case "known":
    break;
}
`
  openRoot := seedLintProject(t, openSource)
  seedLintConfig(t, openRoot, map[string]any{
    "rules": map[string]any{
      switchExhaustivenessCheckRuleName: []any{
        "error",
        map[string]any{"requireDefaultForNonUnion": true},
      },
    },
  })
  openURI := lintTestFileURI(t, filepath.Join(openRoot, "src", "main.ts"))
  openAction := switchExhaustivenessSuggestionActionForTest(t, openRoot, openURI, 1)
  fixed = applySwitchExhaustivenessSuggestionForTest(
    t,
    openRoot,
    openURI,
    openSource,
    openAction,
  )
  knownIndex := strings.Index(fixed, `case "known":`)
  defaultIndex = strings.Index(fixed, "default:")
  if knownIndex < 0 || defaultIndex < 0 || knownIndex >= defaultIndex {
    t.Fatalf("required-default suggestion did not follow the last case:\n%s", fixed)
  }
  assertSwitchExhaustivenessSuggestedSourceForTest(t, openRoot, fixed)
}

func switchExhaustivenessSuggestionActionForTest(
  t *testing.T,
  root string,
  uri string,
  line int,
) lspCodeAction {
  t.Helper()
  rangeJSON := fmt.Sprintf(
    `{"start":{"line":%d,"character":0},"end":{"line":%d,"character":0}}`,
    line,
    line+1,
  )
  actions := runLSPCodeActionsForRangeForTest(
    t,
    root,
    uri,
    rangeJSON,
    `{"only":["quickfix"]}`,
  )
  if len(actions) != 1 || actions[0].Kind != "quickfix.ttsc" ||
    actions[0].Command == nil || actions[0].Command.Command != commandLintApplySuggestion {
    t.Fatalf("switch suggestion actions = %#v", actions)
  }
  return actions[0]
}

func applySwitchExhaustivenessSuggestionForTest(
  t *testing.T,
  root string,
  uri string,
  source string,
  action lspCodeAction,
) string {
  t.Helper()
  edit := executeLSPCommandEditWithArgumentsForTest(
    t,
    root,
    action.Command.Command,
    action.Command.Arguments,
    lintManifest(t),
  )
  if edit == nil {
    t.Fatal("switch suggestion returned no workspace edit")
  }
  return applyLSPWorkspaceEditForTest(t, source, edit.Changes[uri])
}

func assertSwitchExhaustivenessSuggestedSourceForTest(t *testing.T, root string, source string) {
  t.Helper()
  writeFile(t, filepath.Join(root, "src", "main.ts"), source)
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || !isBenignContributorCollisionWarning(stderr) {
    t.Fatalf("suggested source did not re-check cleanly: code=%d stdout=%q stderr=%q\n%s", code, stdout, stderr, source)
  }
}
