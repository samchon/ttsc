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
// @evidence contracts/testing.md#behavioral-verification Writes a settings.json with top-level tabSize 8 and malformed `[][typescript]` and `[typescript][]` sections carrying tabSize 4 and 2, calls editorFormatOverrides for typescript, and asserts tabWidth stays 8.
// @evidence contracts/testing.md#independent-expectations The expected 8 is authored from the rule that a selector with an empty group is not a language selector and must not act as a wildcard or exact scope.
// @evidence contracts/testing.md#distinguishing-cases Two malformed spellings (empty group first, empty group last) must both be ignored; a resolver that dropped only the empty group would let tabSize 4 or 2 win. A well-formed selector is not included in this test.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls editorFormatOverrides on a temp-dir settings file; no VS Code, child process, built binary or installed consumer.
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
