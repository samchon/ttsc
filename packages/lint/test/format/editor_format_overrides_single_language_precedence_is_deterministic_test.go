package linthost

import (
  "path/filepath"
  "testing"
)

// TestEditorFormatOverridesSingleLanguagePrecedenceIsDeterministic verifies an
// exact language section wins over a matching combined section in either JSON
// declaration order.
//
// VS Code gives `[typescript]` semantic precedence over
// `[javascript][typescript]`. Iterating a decoded Go map made the winner depend
// on runtime map order, so repeated resolutions of equivalent settings could
// disagree even though the source did not change.
//
// 1. Write both declaration-order permutations of the conflicting sections.
// 2. Resolve each settings file repeatedly for TypeScript.
// 3. Assert the exact section wins every time.
func TestEditorFormatOverridesSingleLanguagePrecedenceIsDeterministic(t *testing.T) {
  settingsFiles := []string{
    `{
  "[javascript][typescript]": { "editor.tabSize": 4 },
  "[typescript]": { "editor.tabSize": 2 }
}`,
    `{
  "[typescript]": { "editor.tabSize": 2 },
  "[javascript][typescript]": { "editor.tabSize": 4 }
}`,
  }
  for caseIndex, settings := range settingsFiles {
    root := t.TempDir()
    writeFile(t, filepath.Join(root, ".vscode", "settings.json"), settings)
    for iteration := 0; iteration < 64; iteration++ {
      got := editorFormatOverrides(root, "typescript")
      if got["tabWidth"] != float64(2) {
        t.Fatalf(
          "case %d iteration %d: exact language tabWidth should win with 2, got %v",
          caseIndex,
          iteration,
          got["tabWidth"],
        )
      }
    }
  }
}
