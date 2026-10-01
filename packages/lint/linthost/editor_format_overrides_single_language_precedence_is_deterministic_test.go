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
// @evidence contracts/testing.md#behavioral-verification Writes two settings.json files that declare `[javascript][typescript]` (tabSize 4) and `[typescript]` (tabSize 2) in opposite orders and calls editorFormatOverrides for typescript 64 times each, asserting tabWidth 2 every time.
// @evidence contracts/testing.md#independent-expectations The expected 2 is authored from the rule that the exact section wins over a matching combined section regardless of declaration order.
// @evidence contracts/testing.md#distinguishing-cases Both declaration orders are covered, so the exact section wins whether it comes before or after the combined one; the 64 repetitions guard against map-iteration-order dependence, though the current resolver iterates an ordered slice.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls editorFormatOverrides on temp-dir settings files; no VS Code, child process, built binary or installed consumer.
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
