package linthost

import (
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesNormalizeFullLanguageSelectors verifies whitespace
// and duplicate IDs are normalized before exact-scope precedence is decided.
//
// VS Code trims each identifier and removes duplicates from a full language
// selector. `[ typescript ][typescript]` is therefore an exact TypeScript scope,
// not a combined scope that can be overwritten by a later combined selector.
//
// 1. Configure a normalized exact selector before a conflicting combined selector.
// 2. Resolve formatter settings for TypeScript.
// 3. Assert the normalized exact selector still wins.
func TestEditorFormatOverridesNormalizeFullLanguageSelectors(t *testing.T) {
  root := t.TempDir()
  settings := `{
  "[ typescript ][typescript]": { "editor.tabSize": 2 },
  "[javascript][typescript]": { "editor.tabSize": 4 }
}`
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)

  got := editorFormatOverrides(root, "typescript")
  if got["tabWidth"] != float64(2) {
    t.Fatalf("normalized exact language tabWidth should win with 2, got %v", got["tabWidth"])
  }
}
