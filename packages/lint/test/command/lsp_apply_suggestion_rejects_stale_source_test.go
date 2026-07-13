package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestLSPApplySuggestionRejectsStaleSource verifies an old quick fix cannot be
// rebound to a newly generated finding after the document changes.
//
//  1. Capture a command-backed switch suggestion and its source fingerprint.
//  2. Change an unrelated same-width character and save the document.
//  3. Execute the old action and require a null WorkspaceEdit.
func TestLSPApplySuggestionRejectsStaleSource(t *testing.T) {
  source := `const marker = "a";
declare const value: "left" | "right";
switch (value) {
  case "left":
    break;
}
void marker;
`
  root := seedLintProject(t, source)
  seedLintRules(t, root, map[string]string{switchExhaustivenessCheckRuleName: "error"})
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  action := switchExhaustivenessSuggestionActionForTest(t, root, uri, 2)

  changed := strings.Replace(source, `marker = "a"`, `marker = "b"`, 1)
  if changed == source || len(changed) != len(source) {
    t.Fatal("stale-source fixture must change without shifting offsets")
  }
  writeFile(t, filepath.Join(root, "src", "main.ts"), changed)
  edit := executeLSPCommandEditWithArgumentsForTest(
    t,
    root,
    action.Command.Command,
    action.Command.Arguments,
    lintManifest(t),
  )
  if edit != nil {
    t.Fatalf("stale suggestion returned an edit: %#v", edit)
  }
}
