package linthost

import (
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesNormalizeFullLanguageSelectors verifies whitespace
// and duplicate IDs are normalized before exact-scope precedence is decided.
//
// VS Code trims each identifier and removes duplicates from a full language
// selector. `[ ][ typescript ][typescript]` is therefore an exact TypeScript
// scope, not a combined scope that can be overwritten by a later combined
// selector.
//
// 1. Configure normalized exact and bracket-containing combined selectors.
// 2. Resolve formatter settings for TypeScript.
// 3. Assert the exact value wins while the valid combined selector still applies.
// @evidence contracts/testing.md#behavioral-verification editorFormatOverrides reads the disposable settings fixture and resolves normalize full language selectors; assertions check the specified effective values rather than repository settings text.
// @evidence contracts/testing.md#independent-expectations The authored editor setting values and precedence described above determine the literal expected option map independently of resolver traversal or its map iteration order.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure normalized exact and bracket-containing combined selectors. The asserted decision is: Assert the exact value wins while the valid combined selector still applies. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestEditorFormatOverridesNormalizeFullLanguageSelectors is a Go unit entry exercising the settings resolver in process; native fixture files provide resolver input, without invoking VS Code or an installed product host.
func TestEditorFormatOverridesNormalizeFullLanguageSelectors(t *testing.T) {
  root := t.TempDir()
  settings := `{
  "files.eol": "\r\n",
  "[ ][ typescript ][typescript]": { "editor.tabSize": 2 },
  "[[custom][typescript]": { "files.eol": "\n" },
  "[javascript][typescript]": { "editor.tabSize": 4 }
}`
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)

  got := editorFormatOverrides(root, "typescript")
  if got["tabWidth"] != float64(2) {
    t.Fatalf("normalized exact language tabWidth should win with 2, got %v", got["tabWidth"])
  }
  if got["endOfLine"] != "lf" {
    t.Fatalf(
      "bracket-containing identifier should preserve combined endOfLine lf, got %v",
      got["endOfLine"],
    )
  }
}
