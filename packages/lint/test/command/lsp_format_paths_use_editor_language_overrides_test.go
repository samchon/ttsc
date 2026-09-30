package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPFormatPathsUseEditorLanguageOverrides guards the resolver context
// used by editor-originated format requests.
//
// The project-wide, combined, and exact TypeScript values all disagree. LSP
// requests must resolve the real document language and select the exact scope;
// the project-wide CLI must use only the top-level value. Every value is
// deliberately non-default so neither path can pass by skipping settings.
//
//  1. Seed conflicting top-level, combined-language and exact TypeScript settings.
//  2. Require four-space LSP output and three-space project format output.
// @evidence contracts/testing.md#behavioral-verification Editor code actions and disk/buffer formatting use four-space TypeScript indentation while format dispatch uses the three-space project setting.
// @evidence contracts/testing.md#independent-expectations Separately authored four-space editor and three-space CLI texts require their exact indentation and semicolons independently of each other.
// @evidence contracts/testing.md#distinguishing-cases Conflicting top-level 3, combined-language 6 and exact-language 4 values reject defaults, scope merging in the wrong order and CLI leakage of editor context.
// @evidence contracts/testing.md#execution-ownership The native Go editor-settings resolver and formatter execute in process against JSON fixtures; the CLI path is Go command dispatch rather than an installed subprocess.
func TestLSPFormatPathsUseEditorLanguageOverrides(t *testing.T) {
  source := "function outer() {\n     const value = 1\n}\n"
  root := seedLintProject(t, source)
  writeFile(t, filepath.Join(root, ".vscode", "settings.json"), `{
  "editor.tabSize": 3,
  "[javascript][typescript]": { "editor.tabSize": 6 },
  "[typescript]": { "editor.tabSize": 4 }
}`)

  assertLSPFormatPaths(t, root, source, "function outer() {\n    const value = 1;\n}\n")
  assertCLIFormatText(t, root, "function outer() {\n   const value = 1;\n}\n")
}
