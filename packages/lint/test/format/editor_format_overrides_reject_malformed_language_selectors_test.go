package linthost

import (
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesRejectMalformedLanguageSelectors verifies only
// complete non-empty VS Code language selector groups participate in merging.
//
// A selector is a full string of adjacent `[language]` groups. Treating an
// empty group as an independent wildcard would let malformed settings such as
// `[][typescript]` override valid top-level formatter settings.
//
// 1. Configure a top-level tab size and malformed selectors containing empty groups.
// 2. Resolve the settings for TypeScript.
// 3. Assert malformed sections are ignored and the top-level value survives.
func TestEditorFormatOverridesRejectMalformedLanguageSelectors(t *testing.T) {
  root := t.TempDir()
  settings := `{
  "editor.tabSize": 8,
  "[][typescript]": { "editor.tabSize": 4 },
  "[typescript][]": { "editor.tabSize": 2 }
}`
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)

  got := editorFormatOverrides(root, "typescript")
  if got["tabWidth"] != float64(8) {
    t.Fatalf("malformed selectors must not override top-level tabWidth 8, got %v", got["tabWidth"])
  }
}
