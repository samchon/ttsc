package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPFormatPathsHonorEntryIgnores guards scoping parity across every
// formatting front door. A rules-bearing entry is important here: it proves
// ignores are preserved even when the config is not an ignore-only entry.
//
// The rules-bearing ignore entry must apply to every formatting front door, rather than only the ignore-only resolver branch.
//
//  1. Configure a source ignored by an entry that also carries a lint rule.
//  2. Require empty action/edit responses and unchanged source from each format path.
//
// @evidence contracts/testing.md#behavioral-verification A rules-bearing entry ignoring src/main.ts yields no action, no disk edit, an empty buffer edit and unchanged format-dispatch bytes.
// @evidence contracts/testing.md#independent-expectations Empty action/edit expectations and original const value = 1 source bytes independently require a no-op from each front door.
// @evidence contracts/testing.md#distinguishing-cases An ignore entry containing no-var-off rules distinguishes retained ignores from a special ignore-only entry; sibling default hosts supply positive formatting controls.
// @evidence contracts/testing.md#execution-ownership All requests use the existing native Go unit process and a private ignored fixture; no native binary, evaluator or formatter subprocess is invoked.
func TestLSPFormatPathsHonorEntryIgnores(t *testing.T) {
  source := "const value = 1\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "ignores": []string{"src/main.ts"},
    "rules":   map[string]any{"no-var": "off"},
  })
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))

  actions := runLSPCodeActionsForTest(t, root, uri, `{"only":["source.format"]}`)
  if got := actionCommandsForTest(actions); len(got) != 0 {
    t.Fatalf("ignored format actions = %#v, want none", got)
  }
  if edit := executeLSPCommandEditForTest(t, root, uri, commandFormatDocument); edit != nil {
    t.Fatalf("ignored disk format edit = %#v, want nil", edit)
  }
  if edit := executeLSPFormatBufferEditForTest(t, root, uri, source); len(edit.Changes) != 0 {
    t.Fatalf("ignored buffer format edit = %#v, want no changes", edit)
  }

  assertCLIFormatText(t, root, source)
}
