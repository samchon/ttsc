package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesReadsVSCodeSettings verifies editorFormatOverrides
// maps the nearest .vscode/settings.json editor keys onto format-block keys.
//
// formatOnSave with no `format` block must honor the editor's indentation/eol
// settings. This pins the mapping editor.tabSize→tabWidth (as a JSON number),
// editor.insertSpaces→useTabs (inverted), and the JSONC tolerance (comments +
// trailing comma) the parser must survive.
//
// 1. Materialize a temp dir with a JSONC .vscode/settings.json.
// 2. Resolve overrides for a typescript file from that dir.
// 3. Assert tabWidth and useTabs reflect the settings.
func TestEditorFormatOverridesReadsVSCodeSettings(t *testing.T) {
  dir := t.TempDir()
  if err := os.MkdirAll(filepath.Join(dir, ".vscode"), 0o755); err != nil {
    t.Fatalf("mkdir .vscode: %v", err)
  }
  settings := `{
  // four-space tabs, tab characters
  "editor.tabSize": 4,
  "editor.insertSpaces": false,
}`
  if err := os.WriteFile(filepath.Join(dir, ".vscode", "settings.json"), []byte(settings), 0o644); err != nil {
    t.Fatalf("write settings: %v", err)
  }
  got := editorFormatOverrides(dir, "typescript")
  if got["tabWidth"] != float64(4) {
    t.Fatalf("tabWidth: want 4, got %v", got["tabWidth"])
  }
  if got["useTabs"] != true {
    t.Fatalf("useTabs: want true (insertSpaces:false), got %v", got["useTabs"])
  }
}
