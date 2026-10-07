package linthost

import (
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesEquivalentExactSectionsUseLastScope verifies the
// final exact-language scope replaces earlier exact scopes as a whole.
//
// Distinct full selector strings can normalize to the same single language ID.
// VS Code retains only the final matching exact scope, then merges that scope
// over the accumulated combined scopes without reviving keys from earlier exact
// scopes.
//
// 1. Configure an early spaced exact scope with tab and EOL values.
// 2. Follow it with a matching combined scope and a later canonical exact scope.
// 3. Assert only the later exact scope overlays the combined and top-level keys.
//
// @evidence contracts/testing.md#behavioral-verification Writes a settings.json with `[ typescript ]` (spaced, tabSize 3 and `\n` eol), a matching combined section, and a later `[typescript]` tabSize 2, calls editorFormatOverrides for typescript and asserts tabWidth 2, useTabs false and endOfLine crlf.
// @evidence contracts/testing.md#independent-expectations Expected values are authored from the rule that equivalent exact selectors normalize to one language and only the last exact scope applies, over the combined and top-level values.
// @evidence contracts/testing.md#distinguishing-cases crlf shows the superseded exact scope's `\n` does not leak; tabWidth 2 shows the last exact scope wins over the combined 4 and the earlier exact 3; useTabs false shows the combined scope's insertSpaces still applies under the exact scope.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls editorFormatOverrides on a temp-dir settings file; no VS Code, child process, built binary or installed consumer.
func TestEditorFormatOverridesEquivalentExactSectionsUseLastScope(t *testing.T) {
  root := t.TempDir()
  settings := `{
  "editor.tabSize": 8,
  "editor.insertSpaces": false,
  "files.eol": "\r\n",
  "[ typescript ]": {
    "editor.tabSize": 3,
    "files.eol": "\n"
  },
  "[javascript][typescript]": {
    "editor.tabSize": 4,
    "editor.insertSpaces": true
  },
  "[typescript]": { "editor.tabSize": 2 }
}`
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)

  got := editorFormatOverrides(root, "typescript")
  if got["tabWidth"] != float64(2) {
    t.Fatalf("last exact scope should set tabWidth 2, got %v", got["tabWidth"])
  }
  if got["useTabs"] != false {
    t.Fatalf("combined scope should retain useTabs=false, got %v", got["useTabs"])
  }
  if got["endOfLine"] != "crlf" {
    t.Fatalf("superseded exact scope must not leak endOfLine, got %v", got["endOfLine"])
  }
}
