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
// @evidence contracts/testing.md#behavioral-verification editorFormatOverrides reads the disposable settings fixture and resolves single language precedence is deterministic; assertions check the specified effective values rather than repository settings text.
// @evidence contracts/testing.md#independent-expectations The authored editor setting values and precedence described above determine the literal expected option map independently of resolver traversal or its map iteration order.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Write both declaration-order permutations of the conflicting sections. The asserted decision is: Assert the exact section wins every time. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestEditorFormatOverridesSingleLanguagePrecedenceIsDeterministic is a Go unit entry exercising the settings resolver in process; native fixture files provide resolver input, without invoking VS Code or an installed product host.
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
