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
// @evidence contracts/testing.md#behavioral-verification Eight subcases (ts, mts, cts, tsx, js, mjs, cjs, jsx) call vscodeLanguageID to require the VS Code language ID, then write a settings.json with a four-language combined section (tabSize 4) and an exact `[<id>]` section (tabSize 2) and assert editorFormatOverrides gives tabWidth 2.
// @evidence contracts/testing.md#independent-expectations The extension-to-ID table (typescript, typescriptreact, javascript, javascriptreact) is authored from VS Code's language identifiers; the expected 2 follows from exact-section precedence.
// @evidence contracts/testing.md#distinguishing-cases Covers every supported extension across the four IDs, so a precedence fix that recognized only typescript would fail for tsx, js and jsx. Extensions outside the supported set returning no ID are not covered here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls vscodeLanguageID and editorFormatOverrides on temp-dir settings files; no VS Code, child process, built binary or installed consumer.
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
