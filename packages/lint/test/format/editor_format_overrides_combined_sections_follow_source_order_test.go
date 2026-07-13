package linthost

import (
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesCombinedSectionsFollowSourceOrder verifies matching
// combined language sections merge in JSON declaration order before the exact
// language section is applied.
//
// VS Code preserves each full language selector as one override scope. Matching
// combined scopes layer in source order, retain non-conflicting keys, and then
// yield conflicting keys to the exact single-language scope.
//
// 1. Configure top-level, exact, matching, and non-matching combined scopes.
// 2. Give the scopes overlapping and disjoint formatter keys.
// 3. Assert source-order merging and final exact-language precedence.
func TestEditorFormatOverridesCombinedSectionsFollowSourceOrder(t *testing.T) {
  root := t.TempDir()
  settings := `{
  "editor.tabSize": 8,
  "editor.insertSpaces": false,
  "files.eol": "\r\n",
  "[typescript]": {
    "editor.tabSize": 2
  },
  "[json][typescript]": {
    "editor.tabSize": 3,
    "editor.insertSpaces": false
  },
  "[javascript][typescript]": {
    "editor.tabSize": 4,
    "editor.insertSpaces": true
  },
  "[json][markdown]": {
    "editor.insertSpaces": false,
    "files.eol": "\n"
  }
}`
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)

  got := editorFormatOverrides(root, "typescript")
  if got["tabWidth"] != float64(2) {
    t.Fatalf("exact language tabWidth should win with 2, got %v", got["tabWidth"])
  }
  if got["useTabs"] != false {
    t.Fatalf("later combined section should set useTabs=false, got %v", got["useTabs"])
  }
  if got["endOfLine"] != "crlf" {
    t.Fatalf("unshadowed top-level endOfLine should remain crlf, got %v", got["endOfLine"])
  }
}
