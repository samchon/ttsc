package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPPreferAsConstSuggestionExecutesSelectedRange verifies the editor path
// exposes a range-scoped manual quick fix and executes only its stored target.
//
// @evidence contracts/testing.md#behavioral-verification Quickfix range selects the second literal annotation and the source/edit-fingerprint-checked action rewrites only that declaration to as const.
// @evidence contracts/testing.md#independent-expectations The authored complete two-declaration text retains the first annotation and both stringify references while specifying the second rewrite.
// @evidence contracts/testing.md#distinguishing-cases Two eligible declarations and a range covering only the second declaration's line (zero-based line 1) reject a whole-file rewrite or execution of the wrong stored target.
// @evidence contracts/testing.md#execution-ownership Discovery and suggestion execution run in the native Go host with a Program within the unit process; this AST-only rule requests no type checker, and no editor or installed consumer is launched.
func TestLSPPreferAsConstSuggestionExecutesSelectedRange(t *testing.T) {
  source := "let first: (\"one\") = \"one\";\nlet second: (\"two\") = \"two\";\nJSON.stringify(first, second);\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{"typescript/prefer-as-const": "error"},
  })
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  actions := runLSPCodeActionsForRangeForTest(
    t,
    root,
    uri,
    `{"start":{"line":1,"character":0},"end":{"line":1,"character":40}}`,
    `{"only":["quickfix"]}`,
  )
  if len(actions) != 1 || actions[0].Command == nil {
    t.Fatalf("quick-fix actions = %#v", actions)
  }
  action := actions[0]
  if action.Kind != "quickfix.ttsc" || action.Command.Command != commandLintApplySuggestion {
    t.Fatalf("unexpected quick fix = %#v", action)
  }
  edit := executeLSPCommandEditWithArgumentsForTest(
    t,
    root,
    action.Command.Command,
    action.Command.Arguments,
    lintManifest(t),
  )
  if edit == nil || len(edit.Changes) != 1 || len(edit.Changes[uri]) == 0 {
    t.Fatalf("selected suggestion returned no unique edit for %q: %#v", uri, edit)
  }
  rewritten := applyLSPWorkspaceEditForTest(t, source, edit.Changes[uri])
  expected := "let first: (\"one\") = \"one\";\nlet second = \"two\" as const;\nJSON.stringify(first, second);\n"
  if rewritten != expected {
    t.Fatalf("quick-fix source mismatch:\nwant %q\ngot  %q", expected, rewritten)
  }
}
