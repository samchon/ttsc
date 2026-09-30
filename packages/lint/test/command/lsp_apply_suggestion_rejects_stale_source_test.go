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
// @evidence contracts/testing.md#behavioral-verification A captured switch action is executed after an unrelated same-width source edit and must return no WorkspaceEdit, rejecting selection rebinding to changed content.
// @evidence contracts/testing.md#independent-expectations The authored old action and explicit changed source determine the stale fingerprint boundary. A nil edit follows the fail-closed contract, independently of any newly generated action.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Capture a command-backed switch suggestion and its source fingerprint. The asserted decision is: Execute the old action and require a null WorkspaceEdit. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestLSPApplySuggestionRejectsStaleSource owns its fixture cases as an in-process Go test discovered by the shared lint overlay runner. It calls the Go operations directly rather than launching a separately built product host.
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
