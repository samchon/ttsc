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
// @evidence contracts/testing.md#behavioral-verification Writes a settings.json with top-level `editor.tabSize` 8 and `[typescript]` tabSize 2, calls editorFormatOverrides for typescript, and asserts tabWidth is 2.
// @evidence contracts/testing.md#independent-expectations The expected 2 is authored from the rule that a language section overrides the top-level key; it is not derived from the resolver.
// @evidence contracts/testing.md#distinguishing-cases One positive case showing the language section beats the top-level value (a resolver that ignored sections would return 8). Non-matching languages and combined sections are owned by sibling tests, and only tabWidth is asserted.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls editorFormatOverrides on a temp-dir settings file; no VS Code, child process, built binary or installed consumer.
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
