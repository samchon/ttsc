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
