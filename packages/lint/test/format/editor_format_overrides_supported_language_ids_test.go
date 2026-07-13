package linthost

import (
  "fmt"
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesSupportedLanguageIDs verifies every JavaScript and
// TypeScript extension uses its VS Code language ID when resolving overrides.
//
// The formatter supports eight JS/TS extensions but four VS Code language IDs.
// A precedence fix that recognizes only TypeScript would leave JSX, TSX, and
// module-flavored extensions with the combined-scope value.
//
// 1. Map every supported extension to its expected VS Code language ID.
// 2. Configure a combined fallback and an exact section for that ID.
// 3. Assert the exact section wins for every extension.
func TestEditorFormatOverridesSupportedLanguageIDs(t *testing.T) {
  cases := []struct {
    fileName string
    language string
  }{
    {fileName: "file.ts", language: "typescript"},
    {fileName: "file.mts", language: "typescript"},
    {fileName: "file.cts", language: "typescript"},
    {fileName: "file.tsx", language: "typescriptreact"},
    {fileName: "file.js", language: "javascript"},
    {fileName: "file.mjs", language: "javascript"},
    {fileName: "file.cjs", language: "javascript"},
    {fileName: "file.jsx", language: "javascriptreact"},
  }
  for _, testCase := range cases {
    t.Run(testCase.fileName, func(t *testing.T) {
      language := vscodeLanguageID(testCase.fileName)
      if language != testCase.language {
        t.Fatalf("language ID: want %q, got %q", testCase.language, language)
      }
      root := t.TempDir()
      settings := fmt.Sprintf(`{
  "[javascript][javascriptreact][typescript][typescriptreact]": {
    "editor.tabSize": 4
  },
  "[%s]": {
    "editor.tabSize": 2
  }
}`, testCase.language)
      writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)
      got := editorFormatOverrides(root, language)
      if got["tabWidth"] != float64(2) {
        t.Fatalf("exact language tabWidth should win with 2, got %v", got["tabWidth"])
      }
    })
  }
}
