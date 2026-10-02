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
//
// @evidence contracts/testing.md#behavioral-verification Writes a settings.json in which `[json][typescript]` appears twice around `[javascript][typescript]`, with disjoint values in the two occurrences, calls editorFormatOverrides for typescript and asserts tabWidth 6, useTabs false and endOfLine crlf.
// @evidence contracts/testing.md#independent-expectations Expected values are authored from the JSON-object rule that a duplicate property keeps its first position with its last value: the later occurrence replaces the earlier one entirely, so the stale `\n` end-of-line disappears.
// @evidence contracts/testing.md#distinguishing-cases crlf shows the replaced section's stale `\n` is gone; useTabs false shows the replacement's insertSpaces applied; tabWidth 6 shows the replaced section keeps its original position before `[javascript][typescript]` rather than moving last (it would be 4 otherwise).
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls editorFormatOverrides on a temp-dir settings file; no VS Code, child process, built binary or installed consumer.
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
