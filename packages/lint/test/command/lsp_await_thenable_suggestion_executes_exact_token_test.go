package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPAwaitThenableSuggestionExecutesExactToken verifies quickfix.ttsc
// exposes and applies only the await keyword deletion while preserving trivia.
func TestLSPAwaitThenableSuggestionExecutesExactToken(t *testing.T) {
  source := "async function run(): Promise<void> {\n  await /* keep */ 0;\n}\nvoid run();\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{"typescript/await-thenable": "error"},
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
  if action.Title != "Remove unnecessary `await`." || action.Kind != "quickfix.ttsc" ||
    action.Command.Command != commandLintApplySuggestion {
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
  expected := "async function run(): Promise<void> {\n   /* keep */ 0;\n}\nvoid run();\n"
  if rewritten != expected {
    t.Fatalf("quick-fix source mismatch:\nwant %q\ngot  %q", expected, rewritten)
  }
}
