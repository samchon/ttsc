package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPPreferAsConstSuggestionExecutesSelectedRange verifies the editor path
// exposes a range-scoped manual quick fix and executes only its stored target.
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
  rewritten := applyLSPWorkspaceEditForTest(t, source, edit.Changes[uri])
  expected := "let first: (\"one\") = \"one\";\nlet second = \"two\" as const;\nJSON.stringify(first, second);\n"
  if rewritten != expected {
    t.Fatalf("quick-fix source mismatch:\nwant %q\ngot  %q", expected, rewritten)
  }
}
