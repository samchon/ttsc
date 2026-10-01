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
// @evidence contracts/testing.md#behavioral-verification Writes a settings.json with top-level keys, an exact `[typescript]` section, two matching combined sections (`[json][typescript]`, `[javascript][typescript]`) and a non-matching `[json][markdown]` section, calls editorFormatOverrides for typescript, and asserts tabWidth 2, useTabs false and endOfLine crlf.
// @evidence contracts/testing.md#independent-expectations The three expected values are authored from the stated VS Code precedence: matching combined sections layer in declaration order, then the exact single-language section overrides conflicts; they are not computed by the resolver.
// @evidence contracts/testing.md#distinguishing-cases tabWidth 2 shows the exact section wins although it is declared before the combined ones; useTabs false shows the later combined section overrides the earlier one's insertSpaces false; crlf shows the non-matching section's `\n` does not apply and the top-level value survives.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls editorFormatOverrides on a temp-dir settings file; no VS Code, child process, built binary or installed consumer.
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
