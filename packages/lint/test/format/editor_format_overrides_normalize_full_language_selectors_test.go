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
// @evidence contracts/testing.md#behavioral-verification Writes a settings.json with a top-level crlf, an `[ ][ typescript ][typescript]` section (tabSize 2), a `[[custom][typescript]` section (eol `\n`) and a `[javascript][typescript]` section (tabSize 4), calls editorFormatOverrides for typescript, and asserts tabWidth 2 and endOfLine lf.
// @evidence contracts/testing.md#independent-expectations Expected values are authored from the selector-normalization rule (identifiers trimmed, empty ones dropped, duplicates removed, so the first key is the exact TypeScript scope; `[custom` is a distinct non-empty identifier so the third key is a combined scope that still matches); they are not derived from the resolver.
// @evidence contracts/testing.md#distinguishing-cases tabWidth 2 distinguishes treating the normalized first key as exact (wins over the later combined 4) from treating it as a combined scope; endOfLine lf distinguishes a bracket-containing selector that still applies from one that is discarded (the top-level crlf would remain).
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls editorFormatOverrides on a temp-dir settings file; no VS Code, child process, built binary or installed consumer.
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
