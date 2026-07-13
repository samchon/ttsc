package linthost

import (
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesDuplicateLanguageSectionUsesLastValue verifies a
// repeated JSON property replaces its earlier object instead of merging it.
//
// VS Code first parses settings.json into an object, where the final value for
// a duplicate property wins without moving that property's insertion order.
// Treating both occurrences as separate override scopes would preserve stale
// keys that no longer exist in the parsed settings object.
//
// 1. Place a combined language property before another matching property.
// 2. Repeat the first property later with a disjoint replacement object.
// 3. Assert its stale value disappears and its original merge position remains.
func TestEditorFormatOverridesDuplicateLanguageSectionUsesLastValue(t *testing.T) {
  root := t.TempDir()
  settings := `{
  "editor.tabSize": 8,
  "editor.insertSpaces": false,
  "files.eol": "\r\n",
  "[json][typescript]": { "files.eol": "\n" },
  "[javascript][typescript]": { "editor.tabSize": 6 },
  "[json][typescript]": {
    "editor.tabSize": 4,
    "editor.insertSpaces": true
  }
}`
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)

  got := editorFormatOverrides(root, "typescript")
  if got["tabWidth"] != float64(6) {
    t.Fatalf(
      "later distinct section should win at the duplicate key's original position, got %v",
      got["tabWidth"],
    )
  }
  if got["useTabs"] != false {
    t.Fatalf("last section value should set useTabs=false, got %v", got["useTabs"])
  }
  if got["endOfLine"] != "crlf" {
    t.Fatalf(
      "replaced section must not retain stale endOfLine; want crlf, got %v",
      got["endOfLine"],
    )
  }
}
