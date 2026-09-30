package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesLanguageSectionWins verifies a .vscode/settings.json
// language section overrides the top-level editor keys for a matching file.
//
// VS Code resolves `[typescript]` over the document defaults; editorFormatOverrides
// must mirror that so a per-language tabSize wins. This pins the section-match
// + layering order so a regression cannot silently apply the top-level value.
//
// 1. Materialize settings.json with a top-level tabSize and a `[typescript]` one.
// 2. Resolve overrides for a typescript file.
// 3. Assert the language-section tabWidth wins.
// @evidence contracts/testing.md#behavioral-verification editorFormatOverrides reads the disposable settings fixture and resolves language section wins; assertions check the specified effective values rather than repository settings text.
// @evidence contracts/testing.md#independent-expectations The authored editor setting values and precedence described above determine the literal expected option map independently of resolver traversal or its map iteration order.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Materialize settings.json with a top-level tabSize and a `[typescript]` one. The asserted decision is: Assert the language-section tabWidth wins. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestEditorFormatOverridesLanguageSectionWins is a Go unit entry exercising the settings resolver in process; native fixture files provide resolver input, without invoking VS Code or an installed product host.
func TestEditorFormatOverridesLanguageSectionWins(t *testing.T) {
  dir := t.TempDir()
  if err := os.MkdirAll(filepath.Join(dir, ".vscode"), 0o755); err != nil {
    t.Fatalf("mkdir .vscode: %v", err)
  }
  settings := `{ "editor.tabSize": 8, "[typescript]": { "editor.tabSize": 2 } }`
  if err := os.WriteFile(filepath.Join(dir, ".vscode", "settings.json"), []byte(settings), 0o644); err != nil {
    t.Fatalf("write settings: %v", err)
  }
  got := editorFormatOverrides(dir, "typescript")
  if got["tabWidth"] != float64(2) {
    t.Fatalf("tabWidth: language section should win with 2, got %v", got["tabWidth"])
  }
}
