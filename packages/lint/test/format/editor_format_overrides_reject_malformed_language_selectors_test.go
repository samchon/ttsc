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
// @evidence contracts/testing.md#behavioral-verification editorFormatOverrides reads the disposable settings fixture and resolves reject malformed language selectors; assertions check the specified effective values rather than repository settings text.
// @evidence contracts/testing.md#independent-expectations The authored editor setting values and precedence described above determine the literal expected option map independently of resolver traversal or its map iteration order.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure a top-level tab size and malformed selectors containing empty groups. The asserted decision is: Assert malformed sections are ignored and the top-level value survives. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestEditorFormatOverridesRejectMalformedLanguageSelectors is a Go unit entry exercising the settings resolver in process; native fixture files provide resolver input, without invoking VS Code or an installed product host.
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
