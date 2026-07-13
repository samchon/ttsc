package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPBanTsCommentSuggestionPreservesCRLFBlock verifies quickfix.ttsc
// rewrites only the directive inside a block comment above a real type error.
func TestLSPBanTsCommentSuggestionPreservesCRLFBlock(t *testing.T) {
  source := "/* header\r\n * @ts-ignore: Preserve this description */\r\nconst value: number = \"wrong\";\r\nJSON.stringify(value);\r\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{"typescript/ban-ts-comment": "error"},
  })
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  actions := runLSPCodeActionsForRangeForTest(
    t,
    root,
    uri,
    `{"start":{"line":1,"character":0},"end":{"line":1,"character":80}}`,
    `{"only":["quickfix"]}`,
  )
  if len(actions) != 1 || actions[0].Command == nil {
    t.Fatalf("quick-fix actions = %#v", actions)
  }
  action := actions[0]
  if action.Title != "Replace \"@ts-ignore\" with \"@ts-expect-error\"." ||
    action.Kind != "quickfix.ttsc" || action.Command.Command != commandLintApplySuggestion {
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
  expected := "/* header\r\n * @ts-expect-error: Preserve this description */\r\nconst value: number = \"wrong\";\r\nJSON.stringify(value);\r\n"
  if rewritten != expected {
    t.Fatalf("quick-fix source mismatch:\nwant %q\ngot  %q", expected, rewritten)
  }
}
