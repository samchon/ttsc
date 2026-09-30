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
// @evidence contracts/testing.md#behavioral-verification editorFormatOverrides reads the disposable settings fixture and resolves reads vscode settings; assertions check the specified effective values rather than repository settings text.
// @evidence contracts/testing.md#independent-expectations The authored editor setting values and precedence described above determine the literal expected option map independently of resolver traversal or its map iteration order.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Materialize a temp dir with a JSONC .vscode/settings.json. The asserted decision is: Assert tabWidth and useTabs reflect the settings. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestEditorFormatOverridesReadsVSCodeSettings is a Go unit entry exercising the settings resolver in process; native fixture files provide resolver input, without invoking VS Code or an installed product host.
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
