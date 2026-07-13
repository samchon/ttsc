package linthost

import (
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesNormalizeFullLanguageSelectors verifies whitespace
// and duplicate IDs are normalized before exact-scope precedence is decided.
//
// VS Code trims each identifier and removes duplicates from a full language
// selector. `[ ][ typescript ][typescript]` is therefore an exact TypeScript
// scope, not a combined scope that can be overwritten by a later combined
// selector.
//
// 1. Configure normalized exact and bracket-containing combined selectors.
// 2. Resolve formatter settings for TypeScript.
// 3. Assert the exact value wins while the valid combined selector still applies.
func TestEditorFormatOverridesNormalizeFullLanguageSelectors(t *testing.T) {
  root := t.TempDir()
  settings := `{
  "files.eol": "\r\n",
  "[ ][ typescript ][typescript]": { "editor.tabSize": 2 },
  "[[custom][typescript]": { "files.eol": "\n" },
  "[javascript][typescript]": { "editor.tabSize": 4 }
}`
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)

  got := editorFormatOverrides(root, "typescript")
  if got["tabWidth"] != float64(2) {
    t.Fatalf("normalized exact language tabWidth should win with 2, got %v", got["tabWidth"])
  }
  if got["endOfLine"] != "lf" {
    t.Fatalf(
      "bracket-containing identifier should preserve combined endOfLine lf, got %v",
      got["endOfLine"],
    )
  }
}
