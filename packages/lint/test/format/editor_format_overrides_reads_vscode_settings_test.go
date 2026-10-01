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
// @evidence contracts/testing.md#behavioral-verification Writes a JSONC settings.json (line comment, trailing comma) with editor.tabSize 4 and editor.insertSpaces false, calls editorFormatOverrides for typescript, and asserts tabWidth 4 as a number and useTabs true.
// @evidence contracts/testing.md#independent-expectations Expected values are authored from the documented mapping (tabSize to tabWidth, insertSpaces inverted to useTabs); they are not derived from the resolver.
// @evidence contracts/testing.md#distinguishing-cases One positive case covering number mapping, boolean inversion and JSONC tolerance together. A missing file, malformed file or nested directory is covered by other tests; endOfLine is not asserted here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls editorFormatOverrides on a temp-dir settings file; no VS Code, child process, built binary or installed consumer.
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
